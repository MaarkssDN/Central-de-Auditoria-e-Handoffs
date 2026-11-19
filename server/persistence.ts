import fs from 'fs';
import path from 'path';

/**
 * Persistência robusta (Fase 4):
 * - escrita atômica (tmp + rename) — nunca deixa JSON truncado;
 * - lock de arquivo via mkdir (atômico) com timeout e detecção de lock órfão;
 * - variantes sync e async para uso em handlers Express e scripts.
 */

export function atomicWriteFile(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    // Windows pode falhar no rename se o destino estiver aberto — fallback p/ cópia
    try {
      fs.copyFileSync(tmp, file);
      fs.unlinkSync(tmp);
    } catch {
      try { fs.unlinkSync(tmp); } catch { /* noop */ }
      throw err;
    }
  }
}

export function saveJsonAtomic(file: string, value: unknown): void {
  atomicWriteFile(file, JSON.stringify(value, null, 2));
}

export function loadJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export interface FileLockOptions {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
}

function sleepSync(ms: number): void {
  // Atomics.wait funciona na main thread do Node (bloqueia sem queimar CPU).
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLockDir(lockDir: string, opts: Required<FileLockOptions>): void {
  const deadline = Date.now() + opts.timeoutMs;
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      return;
    } catch {
      try {
        const st = fs.statSync(lockDir);
        if (Date.now() - st.mtimeMs > opts.staleMs) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch { /* lock sumiu — tenta de novo */ }
      if (Date.now() > deadline) {
        throw new Error(`Timeout aguardando lock ${lockDir}`);
      }
      sleepSync(opts.retryMs);
    }
  }
}

function releaseLockDir(lockDir: string): void {
  fs.rmSync(lockDir, { recursive: true, force: true });
}

/** Lock síncrono — para trechos curtos de read-modify-write. */
export function withFileLockSync<T>(lockDir: string, fn: () => T, opts: FileLockOptions = {}): T {
  const o = { timeoutMs: 5000, retryMs: 50, staleMs: 30000, ...opts };
  acquireLockDir(lockDir, o);
  try {
    return fn();
  } finally {
    releaseLockDir(lockDir);
  }
}

/** Lock assíncrono — não bloqueia o event loop durante a espera. */
export async function withFileLock<T>(lockDir: string, fn: () => T | Promise<T>, opts: FileLockOptions = {}): Promise<T> {
  const { timeoutMs = 5000, retryMs = 50, staleMs = 30000 } = opts;
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let acquired = false;
  while (!acquired) {
    try {
      fs.mkdirSync(lockDir);
      acquired = true;
    } catch {
      try {
        const st = fs.statSync(lockDir);
        if (Date.now() - st.mtimeMs > staleMs) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch { /* lock sumiu — tenta de novo */ }
      if (Date.now() > deadline) throw new Error(`Timeout aguardando lock ${lockDir}`);
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
  try {
    return await fn();
  } finally {
    releaseLockDir(lockDir);
  }
}
