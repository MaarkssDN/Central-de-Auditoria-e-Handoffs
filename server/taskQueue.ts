import type { NextFunction, Request, Response } from 'express';

/**
 * Fila interna de concorrência limitada (Fase 4).
 * Endpoints pesados (execução de agentes LLM) passam por um semaphore:
 * no máximo `max` execuções simultâneas; o excedente espera na fila.
 */

export interface TaskQueueStats {
  max: number;
  active: number;
  queued: number;
}

export interface TaskQueue {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  stats: () => TaskQueueStats;
  /** Espera as tarefas ativas terminarem ( graceful shutdown ). */
  drain: (timeoutMs?: number) => Promise<boolean>;
}

export function createTaskQueue(max = 2): TaskQueue {
  let active = 0;
  const waiting: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  }

  function release(): void {
    const next = waiting.shift();
    if (next) {
      next(); // slot passa direto para o próximo da fila
    } else {
      active--;
    }
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    run,
    stats: () => ({ max, active, queued: waiting.length }),
    drain: async (timeoutMs = 15000) => {
      const deadline = Date.now() + timeoutMs;
      while (active > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return active === 0;
    },
    middleware: (req, res, next) => {
      acquire().then(() => {
        res.on('close', release);
        next();
      });
    },
  };
}
