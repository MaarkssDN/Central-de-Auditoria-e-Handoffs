import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

export type CentralEventType =
  | 'exec_started'
  | 'exec_heartbeat'
  | 'exec_output'
  | 'exec_done'
  | 'handoff_dispatched'
  | 'handoff_status_changed'
  | 'lock_claimed'
  | 'lock_released'
  | 'coordinator_run_done'
  | 'decision_pending'
  | 'pr_created'
  | 'notification';

export interface CentralEvent {
  ts: string;
  type: CentralEventType;
  data: Record<string, unknown>;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const buffer: CentralEvent[] = [];
const MAX_BUFFER = 200;

export function emitCentralEvent(type: CentralEventType, data: Record<string, unknown> = {}): CentralEvent {
  const ev: CentralEvent = { ts: new Date().toISOString(), type, data };
  buffer.push(ev);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
  emitter.emit('event', ev);
  return ev;
}

export function onCentralEvent(cb: (ev: CentralEvent) => void): () => void {
  emitter.on('event', cb);
  return () => emitter.off('event', cb);
}

export function recentCentralEvents(n = 50): CentralEvent[] {
  return buffer.slice(-n);
}

export function sseHandler(req: Request, res: Response, replay = 50): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'snapshot', events: recentCentralEvents(replay) });

  const off = onCentralEvent((ev) => send(ev));
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    off();
  });
}
