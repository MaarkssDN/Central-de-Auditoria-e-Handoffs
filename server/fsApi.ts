import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { CENTRAL_DIR } from './centralStore';

// Navegador/ editor de arquivos locais.
// Roots permitidas: cwd do app, CENTRAL_DIR e raízes registradas em `fs_roots`
// (ex.: C:\Github). Todo path é canonicalizado e precisa ficar dentro de uma raiz.

const MAX_READ_BYTES = 512 * 1024;
const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.txt',
  '.css', '.scss', '.html', '.yml', '.yaml', '.toml', '.env', '.example',
  '.prisma', '.sql', '.sh', '.ps1', '.bat', '.py', '.go', '.rs', '.java',
  '.c', '.h', '.cpp', '.xml', '.svg', '.gitignore', '.env.example',
]);

function allowedRoots(): string[] {
  const roots = new Set<string>([process.cwd(), CENTRAL_DIR]);
  try {
    const rows = getDb().prepare('SELECT path FROM fs_roots').all() as { path: string }[];
    for (const r of rows) roots.add(path.resolve(r.path));
  } catch { /* db ainda não inicializado */ }
  return [...roots];
}

function resolveSafe(relOrAbs: string): { abs: string; root: string } | { error: string } {
  if (!relOrAbs || typeof relOrAbs !== 'string') return { error: 'Path obrigatório.' };
  const abs = path.resolve(relOrAbs);
  for (const root of allowedRoots()) {
    const rootAbs = path.resolve(root);
    if (abs === rootAbs || abs.startsWith(rootAbs + path.sep)) {
      return { abs, root: rootAbs };
    }
  }
  return { error: 'Acesso negado: path fora das raízes permitidas.' };
}

function audit(action: string, p: string, actor?: string) {
  try {
    getDb()
      .prepare('INSERT INTO fs_audit (action, path, actor) VALUES (?, ?, ?)')
      .run(action, p, actor || 'local');
  } catch { /* auditoria best-effort */ }
}

function listDir(abs: string): { name: string; path: string; type: 'dir' | 'file'; size: number }[] {
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
    .map((e) => ({
      name: e.name,
      path: path.join(abs, e.name),
      type: (e.isDirectory() ? 'dir' : 'file') as 'dir' | 'file',
      size: e.isFile() ? fs.statSync(path.join(abs, e.name)).size : 0,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

export function fsRouter() {
  const router = Router();

  router.get('/roots', (_req, res) => {
    const roots = allowedRoots().map((r) => ({ path: r }));
    const custom = getDb().prepare('SELECT path, label FROM fs_roots').all() as { path: string; label: string | null }[];
    res.json({ roots, custom });
  });

  router.post('/roots', (req: Request, res: Response) => {
    const { path: p, label } = (req.body || {}) as { path?: string; label?: string };
    if (!p) { res.status(400).json({ error: 'Informe o path raiz.' }); return; }
    const abs = path.resolve(p);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      res.status(400).json({ error: 'Diretório inexistente.' });
      return;
    }
    getDb().prepare('INSERT OR REPLACE INTO fs_roots (path, label) VALUES (?, ?)').run(abs, label || null);
    audit('root.add', abs);
    res.json({ ok: true, path: abs });
  });

  router.delete('/roots', (req: Request, res: Response) => {
    const { path: p } = (req.body || {}) as { path?: string };
    if (p) getDb().prepare('DELETE FROM fs_roots WHERE path = ?').run(path.resolve(p));
    res.json({ ok: true });
  });

  router.get('/list', (req: Request, res: Response) => {
    const target = String(req.query.path || '');
    const resolved = resolveSafe(target);
    if ('error' in resolved) { res.status(403).json({ error: resolved.error }); return; }
    try {
      res.json({ path: resolved.abs, entries: listDir(resolved.abs) });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Falha ao listar.' });
    }
  });

  router.get('/read', (req: Request, res: Response) => {
    const target = String(req.query.path || '');
    const resolved = resolveSafe(target);
    if ('error' in resolved) { res.status(403).json({ error: resolved.error }); return; }
    try {
      const st = fs.statSync(resolved.abs);
      if (st.isDirectory()) { res.status(400).json({ error: 'É um diretório — use /list.' }); return; }
      if (st.size > MAX_READ_BYTES) {
        res.status(413).json({ error: `Arquivo grande demais (${st.size} bytes > ${MAX_READ_BYTES}).` });
        return;
      }
      const ext = path.extname(resolved.abs).toLowerCase();
      const isText = TEXT_EXT.has(ext) || !ext || ext === '.env';
      if (!isText) {
        res.status(415).json({ error: 'Tipo de arquivo não suportado para leitura textual.' });
        return;
      }
      const content = fs.readFileSync(resolved.abs, 'utf-8');
      res.json({ path: resolved.abs, content, size: st.size });
    } catch {
      res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
  });

  router.put('/write', (req: Request, res: Response) => {
    const { path: target, content } = (req.body || {}) as { path?: string; content?: string };
    if (typeof target !== 'string' || typeof content !== 'string') {
      res.status(400).json({ error: 'Informe path e content.' });
      return;
    }
    if (Buffer.byteLength(content, 'utf-8') > MAX_WRITE_BYTES) {
      res.status(413).json({ error: 'Conteúdo excede o limite de escrita.' });
      return;
    }
    const resolved = resolveSafe(target);
    if ('error' in resolved) { res.status(403).json({ error: resolved.error }); return; }
    try {
      fs.mkdirSync(path.dirname(resolved.abs), { recursive: true });
      fs.writeFileSync(resolved.abs, content, 'utf-8');
      audit('file.write', resolved.abs);
      res.json({ ok: true, path: resolved.abs });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Falha ao gravar.' });
    }
  });

  router.get('/audit', (_req, res) => {
    const rows = getDb()
      .prepare('SELECT action, path, actor, created_at FROM fs_audit ORDER BY id DESC LIMIT 100')
      .all();
    res.json({ audit: rows });
  });

  return router;
}
