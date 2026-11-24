import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  getDb,
  closeDb,
  resolveDbPath,
  getDbPath,
  isDbOpen,
  getDbStats,
  saveChatMessage,
  getChatMessages,
  clearChatMessages,
  cleanExpiredSessions,
} from './db';

test('resolveDbPath respeita variáveis de ambiente e fallback padrão', () => {
  const origEnv = { ...process.env };
  try {
    delete process.env.CENTRAL_DB_PATH;
    delete process.env.SQLITE_DB_PATH;
    delete process.env.CENTRAL_DATA_DIR;
    delete process.env.DATA_DIR;

    const defaultPath = resolveDbPath();
    assert.ok(defaultPath.endsWith(path.join('data', 'central.db')));

    process.env.SQLITE_DB_PATH = 'data/test-custom.db';
    assert.equal(resolveDbPath(), path.resolve('data/test-custom.db'));

    process.env.CENTRAL_DB_PATH = ':memory:';
    assert.equal(resolveDbPath(), ':memory:');
  } finally {
    process.env = origEnv;
  }
});

test('getDb inicializa banco em memória com pragmas corretos', () => {
  closeDb();
  assert.equal(isDbOpen(), false);

  const db = getDb(':memory:');
  assert.equal(isDbOpen(), true);
  assert.equal(getDbPath(), ':memory:');

  // Verifica foreign_keys
  const fkRow = db.prepare('PRAGMA foreign_keys;').get() as Record<string, unknown>;
  assert.equal(Object.values(fkRow)[0], 1);

  // Verifica busy_timeout
  const btRow = db.prepare('PRAGMA busy_timeout;').get() as Record<string, unknown>;
  assert.equal(Object.values(btRow)[0], 5000);

  // Verifica tabelas criadas pela migration
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);

  assert.ok(tableNames.includes('users'));
  assert.ok(tableNames.includes('sessions'));
  assert.ok(tableNames.includes('provider_configs'));
  assert.ok(tableNames.includes('chat_messages'));
  assert.ok(tableNames.includes('fs_roots'));
  assert.ok(tableNames.includes('fs_audit'));

  closeDb();
  assert.equal(isDbOpen(), false);
});

test('users e sessions: cascata de deleção e limpeza de sessões expiradas', () => {
  closeDb();
  const db = getDb(':memory:');

  // Insere usuário
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (?, ?, ?, ?)
  `).run('user-1', 'admin@test.com', 'Admin Test', 'hash123');

  // Insere sessão ativa e sessão expirada
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run('token-active', 'user-1', new Date(Date.now() + 60000).toISOString());

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run('token-expired', 'user-1', new Date(Date.now() - 60000).toISOString());

  let sessionCount = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }).c;
  assert.equal(sessionCount, 2);

  // Limpa sessões expiradas
  const cleaned = cleanExpiredSessions();
  assert.equal(cleaned, 1);

  const remaining = db.prepare('SELECT token FROM sessions').all() as { token: string }[];
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].token, 'token-active');

  // Cascade delete ao remover o usuário
  db.prepare('DELETE FROM users WHERE id = ?').run('user-1');
  sessionCount = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }).c;
  assert.equal(sessionCount, 0);

  closeDb();
});

test('provider_configs: inserção e atualização (upsert)', () => {
  closeDb();
  const db = getDb(':memory:');

  db.prepare(`
    INSERT INTO provider_configs (provider_id, config)
    VALUES (?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET config = excluded.config
  `).run('gemini', JSON.stringify({ model: 'gemini-4-hydrogen' }));

  let row = db.prepare('SELECT config FROM provider_configs WHERE provider_id = ?').get('gemini') as { config: string };
  assert.deepEqual(JSON.parse(row.config), { model: 'gemini-4-hydrogen' });

  // Update
  db.prepare(`
    INSERT INTO provider_configs (provider_id, config)
    VALUES (?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET config = excluded.config
  `).run('gemini', JSON.stringify({ model: 'gemini-4-hydrogen', enabled: true }));

  row = db.prepare('SELECT config FROM provider_configs WHERE provider_id = ?').get('gemini') as { config: string };
  assert.deepEqual(JSON.parse(row.config), { model: 'gemini-4-hydrogen', enabled: true });

  closeDb();
});

test('chat_messages: persistência, ordenação, paginação e exclusão', () => {
  closeDb();
  getDb(':memory:');

  const id1 = saveChatMessage('session-alpha', 'user', 'Olá coordenador', null);
  const id2 = saveChatMessage('session-alpha', 'assistant', 'Olá! Como posso ajudar?', '00');
  const id3 = saveChatMessage('session-alpha', 'user', 'Verifique os handoffs pendentes');
  const _idBeta = saveChatMessage('session-beta', 'user', 'Mensagem de outra sessão');

  assert.ok(id1 > 0);
  assert.ok(id2 > id1);
  assert.ok(id3 > id2);

  // Recupera mensagens da session-alpha
  const msgs = getChatMessages('session-alpha');
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].role, 'user');
  assert.equal(msgs[0].content, 'Olá coordenador');
  assert.equal(msgs[0].agent_id, null);

  assert.equal(msgs[1].role, 'assistant');
  assert.equal(msgs[1].content, 'Olá! Como posso ajudar?');
  assert.equal(msgs[1].agent_id, '00');

  // Paginação (limit 2, offset 1)
  const paged = getChatMessages('session-alpha', 2, 1);
  assert.equal(paged.length, 2);
  assert.equal(paged[0].id, id2);
  assert.equal(paged[1].id, id3);

  // Limpa apenas session-alpha
  const clearedAlpha = clearChatMessages('session-alpha');
  assert.equal(clearedAlpha, 3);
  assert.equal(getChatMessages('session-alpha').length, 0);
  assert.equal(getChatMessages('session-beta').length, 1);

  // Limpa tudo
  const clearedAll = clearChatMessages();
  assert.equal(clearedAll, 1);
  assert.equal(getChatMessages('session-beta').length, 0);

  closeDb();
});

test('fs_roots e fs_audit: registro de caminhos e trilha de auditoria', () => {
  closeDb();
  const db = getDb(':memory:');

  db.prepare('INSERT INTO fs_roots (path, label) VALUES (?, ?)').run('C:\\repo1', 'Repositório 1');
  const root = db.prepare('SELECT path, label FROM fs_roots WHERE path = ?').get('C:\\repo1') as { path: string; label: string };
  assert.equal(root.path, 'C:\\repo1');
  assert.equal(root.label, 'Repositório 1');

  db.prepare('INSERT INTO fs_audit (action, path, actor) VALUES (?, ?, ?)').run('read', 'C:\\repo1\\file.ts', 'marcelo');
  const audit = db.prepare('SELECT action, path, actor FROM fs_audit WHERE path = ?').get('C:\\repo1\\file.ts') as { action: string; path: string; actor: string };
  assert.equal(audit.action, 'read');
  assert.equal(audit.actor, 'marcelo');

  closeDb();
});

test('getDbStats: retorna métricas do banco e integridade ok', () => {
  closeDb();
  getDb(':memory:');

  saveChatMessage('session-stats', 'user', 'Teste de stats');

  const stats = getDbStats();
  assert.equal(stats.connected, true);
  assert.equal(stats.integrityOk, true);
  assert.equal(stats.foreignKeys, true);
  assert.equal(stats.busyTimeout, 5000);
  assert.ok(stats.tables.chat_messages >= 1);
  assert.ok(stats.tables.users >= 0);

  closeDb();
});

test('banco em arquivo temporário: suporta WAL mode e sincronização', () => {
  closeDb();
  const tmpDir = path.join(process.cwd(), 'data', '.test_sqlite');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpDbPath = path.join(tmpDir, 'test.db');

  try {
    const db = getDb(tmpDbPath);
    assert.equal(getDbPath(), tmpDbPath);

    const stats = getDbStats();
    assert.equal(stats.integrityOk, true);
    assert.equal(stats.journalMode.toLowerCase(), 'wal');
    assert.ok(typeof stats.sizeBytes === 'number');

    closeDb();
  } finally {
    closeDb();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignora erro de limpeza no Windows caso arquivo esteja em desbloqueio
    }
  }
});
