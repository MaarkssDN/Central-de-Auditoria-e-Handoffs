import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

// Banco local da Central (SQLite via node:sqlite nativo do Node.js, sem dependência externa).
// data/ já é gitignored — usuários, sessões, configs de providers, auditoria de arquivos e chat ficam
// apenas nesta máquina.

let db: DatabaseSync | null = null;
let activeDbPath: string | null = null;

/**
 * Resolve o caminho do banco de dados SQLite com suporte a variáveis de ambiente:
 * 1. CENTRAL_DB_PATH
 * 2. SQLITE_DB_PATH
 * 3. CENTRAL_DATA_DIR / DATA_DIR + central.db
 * 4. Padrão: <cwd>/data/central.db
 * Também suporta ':memory:' para testes rápidos em memória.
 */
export function resolveDbPath(): string {
  const envPath = process.env.CENTRAL_DB_PATH || process.env.SQLITE_DB_PATH;
  if (envPath) {
    if (envPath.trim() === ':memory:') return ':memory:';
    return path.resolve(envPath.trim());
  }

  const dataDir = process.env.CENTRAL_DATA_DIR || process.env.DATA_DIR
    ? path.resolve((process.env.CENTRAL_DATA_DIR || process.env.DATA_DIR)!.trim())
    : path.resolve(process.cwd(), 'data');

  return path.join(dataDir, 'central.db');
}

/**
 * Retorna o caminho atualmente conectado ou o caminho padrão resolvido.
 */
export function getDbPath(): string {
  return activeDbPath || resolveDbPath();
}

/**
 * Verifica se a conexão com o banco SQLite está ativa.
 */
export function isDbOpen(): boolean {
  return db !== null;
}

/**
 * Obtém ou inicializa a instância do banco SQLite (singleton).
 * Se customPath for fornecido e o banco atual estiver fechado ou com caminho diferente,
 * inicializa o banco com o novo caminho.
 */
export function getDb(customPath?: string): DatabaseSync {
  const targetPath = customPath ? (customPath === ':memory:' ? ':memory:' : path.resolve(customPath)) : resolveDbPath();

  if (db) {
    if (!customPath || activeDbPath === targetPath) {
      return db;
    }
    // Fechar e reabrir caso um caminho diferente tenha sido solicitado
    closeDb();
  }

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new DatabaseSync(targetPath);
  activeDbPath = targetPath;

  // Configurações e PRAGMAs de alta concorrência e integridade
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -20000;'); // ~20MB cache
  }

  migrate(db);
  return db;
}

/**
 * Cria ou atualiza as tabelas e índices essenciais do SQLite.
 */
function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS provider_configs (
      provider_id TEXT PRIMARY KEY,
      config TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      agent_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS fs_roots (
      path TEXT PRIMARY KEY,
      label TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fs_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      path TEXT NOT NULL,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fs_audit_created ON fs_audit(created_at);
  `);
}

/**
 * Fecha a conexão com o banco de dados.
 */
export function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {
      // Ignora erro ao fechar conexão já finalizada
    }
    db = null;
    activeDbPath = null;
  }
}

export interface ChatMessageRecord {
  id: number;
  session_id: string;
  role: string;
  agent_id: string | null;
  content: string;
  created_at: string;
}

/**
 * Salva uma mensagem no histórico do chat SQLite.
 */
export function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  agentId?: string | null,
): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO chat_messages (session_id, role, agent_id, content)
    VALUES (?, ?, ?, ?)
  `);
  const res = stmt.run(sessionId, role, agentId || null, content);
  return Number(res.lastInsertRowid);
}

/**
 * Recupera as mensagens de uma sessão do chat SQLite.
 */
export function getChatMessages(
  sessionId: string,
  limit = 100,
  offset = 0,
): ChatMessageRecord[] {
  const d = getDb();
  const stmt = d.prepare(`
    SELECT id, session_id, role, agent_id, content, created_at
    FROM chat_messages
    WHERE session_id = ?
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(sessionId, limit, offset) as unknown as ChatMessageRecord[];
}

/**
 * Remove mensagens de uma sessão ou de todas as sessões do chat.
 */
export function clearChatMessages(sessionId?: string): number {
  const d = getDb();
  if (sessionId) {
    const res = d.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
    return Number(res.changes);
  }
  const res = d.prepare('DELETE FROM chat_messages').run();
  return Number(res.changes);
}

/**
 * Limpa sessões expiradas no banco SQLite.
 */
export function cleanExpiredSessions(): number {
  const d = getDb();
  const res = d.prepare("DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')").run();
  return Number(res.changes);
}

export interface DbStats {
  path: string;
  connected: boolean;
  journalMode: string;
  foreignKeys: boolean;
  busyTimeout: number;
  tables: Record<string, number>;
  sizeBytes: number | null;
  integrityOk: boolean;
}

/**
 * Retorna estatísticas de integridade, tamanho e contagem de registros do SQLite.
 */
export function getDbStats(): DbStats {
  const d = getDb();
  const p = getDbPath();

  const tables = ['users', 'sessions', 'provider_configs', 'chat_messages', 'fs_roots', 'fs_audit'];
  const tableCounts: Record<string, number> = {};

  for (const t of tables) {
    try {
      const row = d.prepare(`SELECT COUNT(*) as count FROM ${t}`).get() as { count: number } | undefined;
      tableCounts[t] = Number(row?.count ?? 0);
    } catch {
      tableCounts[t] = 0;
    }
  }

  let integrityOk = false;
  try {
    const row = d.prepare('PRAGMA integrity_check;').get() as Record<string, unknown> | undefined;
    integrityOk = Object.values(row || {})[0] === 'ok';
  } catch {
    integrityOk = false;
  }

  let journalMode = 'unknown';
  try {
    const row = d.prepare('PRAGMA journal_mode;').get() as Record<string, unknown> | undefined;
    journalMode = String(Object.values(row || {})[0] || 'unknown');
  } catch {
    // fallback
  }

  let foreignKeys = false;
  try {
    const row = d.prepare('PRAGMA foreign_keys;').get() as Record<string, unknown> | undefined;
    foreignKeys = Object.values(row || {})[0] === 1;
  } catch {
    // fallback
  }

  let busyTimeout = 0;
  try {
    const row = d.prepare('PRAGMA busy_timeout;').get() as Record<string, unknown> | undefined;
    busyTimeout = Number(Object.values(row || {})[0] || 0);
  } catch {
    // fallback
  }

  let sizeBytes: number | null = null;
  if (p !== ':memory:' && fs.existsSync(p)) {
    try {
      sizeBytes = fs.statSync(p).size;
    } catch {
      sizeBytes = null;
    }
  }

  return {
    path: p,
    connected: isDbOpen(),
    journalMode,
    foreignKeys,
    busyTimeout,
    tables: tableCounts,
    sizeBytes,
    integrityOk,
  };
}
