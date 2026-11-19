import { emitCentralEvent, type CentralEvent, type CentralEventType } from './centralEvents';

const WEBHOOK = process.env.CENTRAL_NOTIFY_WEBHOOK || '';
const DEFAULT_EVENTS = [
  'handoff_dispatched',
  'handoff_status_changed',
  'exec_done',
  'coordinator_run_done',
  'decision_pending',
  'pr_created',
];
const EVENT_FILTER = (process.env.CENTRAL_NOTIFY_EVENTS || DEFAULT_EVENTS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function notificationsConfigured(): boolean {
  return Boolean(WEBHOOK);
}

function formatMessage(ev: CentralEvent): string {
  const d = ev.data as Record<string, string | undefined>;
  const parts = [
    `*${ev.type}*`,
    d.handoff ? `handoff: ${d.handoff}` : '',
    d.agent ? `agente: ${d.agent}` : '',
    d.provider ? `provider: ${d.provider}` : '',
    d.from && d.to ? `${d.from} → ${d.to}` : '',
    d.exitCode != null ? `exit: ${d.exitCode}` : '',
    d.prUrl ? `PR: ${d.prUrl}` : '',
    d.notes ? `obs: ${String(d.notes).slice(0, 200)}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function buildPayload(ev: CentralEvent): Record<string, unknown> {
  const text = formatMessage(ev);
  const isDiscord = WEBHOOK.includes('discord');
  const isSlack = WEBHOOK.includes('hooks.slack');
  if (isDiscord) {
    return { content: text.slice(0, 1900), allowed_mentions: { parse: [] } };
  }
  if (isSlack) {
    return { text };
  }
  return { type: ev.type, ts: ev.ts, text, data: ev.data };
}

export async function notifyCentralEvent(ev: CentralEvent): Promise<{ sent: boolean; status?: number; error?: string }> {
  if (!WEBHOOK || !EVENT_FILTER.includes(ev.type)) return { sent: false };
  emitCentralEvent('notification', { for: ev.type });
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(ev)),
    });
    if (!res.ok) return { sent: false, status: res.status, error: `webhook HTTP ${res.status}` };
    return { sent: true, status: res.status };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'falha no webhook' };
  }
}

// Assina o barramento: toda evento central dispara notificação se configurada.
import { onCentralEvent } from './centralEvents';
onCentralEvent((ev) => {
  if (ev.type === 'notification') return;
  void notifyCentralEvent(ev);
});
