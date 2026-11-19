export const CANONICAL_STATUS = [
  'PENDENTE',
  'EM_EXECUÇÃO',
  'AGUARDANDO_24',
  'REPROVADO_24',
  'BLOQUEADO',
  'CONCLUÍDO',
] as const;

export type CanonicalStatus = (typeof CANONICAL_STATUS)[number];

export const STATUS_ALIASES: Record<string, CanonicalStatus> = {
  PENDENTE: 'PENDENTE',
  ABERTO: 'PENDENTE',
  EM_EXECUÇÃO: 'EM_EXECUÇÃO',
  EM_EXECUCAO: 'EM_EXECUÇÃO',
  EM_ANDAMENTO: 'EM_EXECUÇÃO',
  AGUARDANDO_24: 'AGUARDANDO_24',
  REPROVADO_24: 'REPROVADO_24',
  BLOQUEADO: 'BLOQUEADO',
  CONCLUÍDO: 'CONCLUÍDO',
  CONCLUIDO: 'CONCLUÍDO',
  RESOLVIDO: 'CONCLUÍDO',
};

const ALLOWED: Record<CanonicalStatus, CanonicalStatus[]> = {
  PENDENTE: ['EM_EXECUÇÃO', 'BLOQUEADO'],
  EM_EXECUÇÃO: ['AGUARDANDO_24', 'REPROVADO_24', 'BLOQUEADO', 'CONCLUÍDO', 'PENDENTE'],
  AGUARDANDO_24: ['CONCLUÍDO', 'REPROVADO_24', 'EM_EXECUÇÃO', 'BLOQUEADO'],
  REPROVADO_24: ['EM_EXECUÇÃO', 'PENDENTE', 'BLOQUEADO'],
  BLOQUEADO: ['PENDENTE', 'EM_EXECUÇÃO', 'CONCLUÍDO'],
  CONCLUÍDO: ['EM_EXECUÇÃO'],
};

export function normalizeStatus(raw: string): CanonicalStatus | null {
  const key = raw.trim().toUpperCase();
  if (key in STATUS_ALIASES) return STATUS_ALIASES[key];
  const found = CANONICAL_STATUS.find((s) => key.includes(s));
  return found || null;
}

export function isValidTransition(from: CanonicalStatus, to: CanonicalStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function canTransition(from: string, toRaw: string): { ok: boolean; to?: CanonicalStatus; error?: string } {
  const fromNorm = normalizeStatus(from) || 'PENDENTE';
  const to = normalizeStatus(toRaw);
  if (!to) {
    return { ok: false, error: `Status inválido: '${toRaw}'.` };
  }
  if (!isValidTransition(fromNorm, to)) {
    return {
      ok: false,
      error: `Transição inválida: ${fromNorm} → ${to}. Permitidas: ${[fromNorm, ...ALLOWED[fromNorm]].join(', ')}.`,
    };
  }
  return { ok: true, to };
}

export function terminalStatuses(): CanonicalStatus[] {
  return ['CONCLUÍDO'];
}

export default { CANONICAL_STATUS, normalizeStatus, isValidTransition, canTransition, terminalStatuses };
