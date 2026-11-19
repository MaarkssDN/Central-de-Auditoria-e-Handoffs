import crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { getDb } from './db';

// Autenticação local simples (app de console local, usuário único).
// Senha hasheada com scrypt; sessão em cookie httpOnly + tabela `sessions`.

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'central_session';

export const ADMIN_EMAIL = 'marcelinmark@gmail.com';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function ensureAdminUser() {
  const d = getDb();
  const existing = d.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (existing) return;
  // Senha inicial: env CENTRAL_ADMIN_PASSWORD ou 'birthhub360' — trocar após o 1º login.
  const password = process.env.CENTRAL_ADMIN_PASSWORD || 'birthhub360';
  d.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    ADMIN_EMAIL,
    'Marcelo',
    hashPassword(password),
  );
  console.log(`[auth] usuário admin provisionado: ${ADMIN_EMAIL} (troque CENTRAL_ADMIN_PASSWORD ou a senha no banco)`);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function getSessionUser(req: Request): { id: string; email: string; name: string } | null {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const d = getDb();
  const row = d
    .prepare(
      `SELECT u.id, u.email, u.name, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    )
    .get(token) as { id: string; email: string; name: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    d.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  (req as Request & { user?: typeof user }).user = user;
  next();
}

export function authRouter() {
  const router = Router();

  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha.' });
      return;
    }
    const d = getDb();
    const user = d.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
      | { id: string; email: string; name: string; password_hash: string }
      | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    d.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    );
    res.json({ ok: true, user: { email: user.email, name: user.name } });
  });

  router.post('/logout', (req: Request, res: Response) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  router.get('/me', (req: Request, res: Response) => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }
    res.json({ user });
  });

  return router;
}
