import type { CentralState, ParsedHandoff } from './centralStore';

/**
 * Export executivo por onda (Fase 4): HTML standalone com veredito,
 * status dos handoffs, evidências (resolução/revisão 24), dossiês e
 * decisões — imprimível para PDF via "Salvar como PDF" do navegador.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: '#7488ab',
  'EM_EXECUÇÃO': '#38bdf8',
  AGUARDANDO_24: '#fbbf24',
  REPROVADO_24: '#f87171',
  BLOQUEADO: '#f87171',
  'CONCLUÍDO': '#34d399',
};

function statusChip(status: string): string {
  const c = STATUS_COLORS[status] || '#7488ab';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font:600 11px ui-monospace,monospace;color:${c};border:1px solid ${c}55;background:${c}14">${esc(status)}</span>`;
}

function prioBadge(p: string): string {
  const c = p === 'P0' ? '#f87171' : p === 'P1' ? '#fbbf24' : p === 'P2' ? '#38bdf8' : '#55678c';
  return `<span style="font:700 11px ui-monospace,monospace;color:${c}">${esc(p)}</span>`;
}

function section(title: string, inner: string): string {
  return `<section style="margin:28px 0"><h2 style="font:700 15px 'Segoe UI',sans-serif;color:#e8eef8;border-bottom:1px solid #1a2a4a;padding-bottom:8px;margin:0 0 14px">${esc(title)}</h2>${inner}</section>`;
}

function handoffCard(h: ParsedHandoff): string {
  const res = h.resolucao
    ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:#7dd3fc;font:12px ui-monospace,monospace">Resolução / evidências</summary><pre style="white-space:pre-wrap;font:12px/1.6 ui-monospace,monospace;color:#9fb0cf;background:#02050c;border:1px solid #1a2a4a;border-radius:8px;padding:12px;margin-top:8px">${esc(h.resolucao.slice(0, 4000))}</pre></details>`
    : '';
  const rev = h.revisao24
    ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:#a78bfa;font:12px ui-monospace,monospace">Revisão 24</summary><pre style="white-space:pre-wrap;font:12px/1.6 ui-monospace,monospace;color:#9fb0cf;background:#02050c;border:1px solid #1a2a4a;border-radius:8px;padding:12px;margin-top:8px">${esc(h.revisao24.slice(0, 4000))}</pre></details>`
    : '';
  return `<div style="border:1px solid #1a2a4a;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#0b1322">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${prioBadge(h.prioridade)}${statusChip(h.status)}<strong style="color:#e8eef8;font-size:14px">${esc(h.title)}</strong></div>
    <div style="font:11px ui-monospace,monospace;color:#55678c;margin-top:6px">${esc(h.name)} · De ${esc(h.de || '?')} → Para ${esc(h.para || '?')} · deps: ${h.dependencias.length ? esc(h.dependencias.join(', ')) : 'nenhuma'}</div>
    ${res}${rev}
  </div>`;
}

export function buildWaveReportHtml(state: CentralState, waveName?: string): string {
  const waves = waveName ? state.waves.filter((w) => w.name === waveName) : state.waves;
  const waveSet = new Set(waves.map((w) => w.name));
  const handoffs = state.handoffs.filter((h) => waveSet.size === 0 || waveSet.has(h.onda) || h.relPath.includes(`ondas/${waveName}/`));
  const audits = state.audits.filter((a) => !waveName || a.file.includes(`ondas/${waveName}/`));
  const reviews = state.reviews.filter((r) => !waveName || r.file.includes(`ondas/${waveName}/`));

  const counts = handoffs.reduce<Record<string, number>>((a, h) => { a[h.status] = (a[h.status] || 0) + 1; return a; }, {});
  const concluido = counts['CONCLUÍDO'] || 0;
  const reprovado = counts['REPROVADO_24'] || 0;
  const bloqueado = counts['BLOQUEADO'] || 0;
  const veredito = String((state.state as { veredito?: string }).veredito || '—');
  const noGo = veredito.toUpperCase().includes('NO-GO');
  const verdictColor = noGo ? '#f87171' : veredito.toUpperCase().includes('GO') ? '#34d399' : '#fbbf24';

  const escNote = (state.state as { waveStatus?: string }).waveStatus || '';

  const handoffRows = handoffs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(handoffCard)
    .join('');

  const auditList = audits.length
    ? `<ul style="margin:0;padding-left:18px;color:#9fb0cf;font-size:13px">${audits.map((a) => `<li style="margin:4px 0"><code style="color:#7dd3fc">${esc(a.name)}</code> — ${esc(a.file)}</li>`).join('')}</ul>`
    : '<p style="color:#55678c;font-size:13px">Nenhum dossiê de auditoria nesta onda.</p>';

  const reviewList = reviews.length
    ? `<ul style="margin:0;padding-left:18px;color:#9fb0cf;font-size:13px">${reviews.map((r) => `<li style="margin:4px 0"><code style="color:#a78bfa">${esc(r.name)}</code> — ${esc(r.file)}</li>`).join('')}</ul>`
    : '<p style="color:#55678c;font-size:13px">Nenhuma revisão registrada nesta onda.</p>';

  const decisionList = state.decisions.length
    ? state.decisions.map((d) => `<div style="border-left:2px solid #fbbf24;padding:6px 0 6px 12px;margin-bottom:10px"><strong style="color:#e8eef8;font-size:13px">${esc(d.id)} — ${esc(d.title)}</strong><pre style="white-space:pre-wrap;font:12px/1.6 ui-monospace,monospace;color:#9fb0cf;margin:6px 0 0">${esc(d.body.slice(0, 1500))}</pre></div>`).join('')
    : '<p style="color:#55678c;font-size:13px">Nenhuma decisão humana registrada.</p>';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Executivo — ${esc(waveName || 'Todas as ondas')}</title>
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#05080f;color:#e8eef8;max-width:960px;margin:0 auto;padding:40px 24px;line-height:1.6}</style></head><body>
<h1 style="font-size:26px;margin:0 0 4px">Relatório Executivo — Central de Auditoria</h1>
<div style="font:12px ui-monospace,monospace;color:#55678c">Gerado em ${esc(state.generatedAt)} · onda: ${esc(waveName || 'todas')} · fonte: central/ (markdown versionado)</div>

<div style="display:flex;gap:10px;flex-wrap:wrap;margin:22px 0">
  <div style="border:1px solid ${verdictColor}55;border-radius:10px;padding:12px 18px;background:${verdictColor}10"><div style="font:10px ui-monospace,monospace;color:#55678c;letter-spacing:.15em">VEREDITO</div><div style="font:700 18px ui-monospace,monospace;color:${verdictColor}">${esc(veredito)}</div></div>
  ${Object.entries(counts).map(([s, n]) => `<div style="border:1px solid #1a2a4a;border-radius:10px;padding:12px 16px;background:#0b1322"><div style="font:10px ui-monospace,monospace;color:#55678c">${esc(s)}</div><div style="font:700 18px ui-monospace,monospace;color:${STATUS_COLORS[s] || '#e8eef8'}">${n}</div></div>`).join('')}
</div>
${escNote ? `<p style="color:#9fb0cf;font-size:14px;border-left:2px solid #38bdf8;padding:8px 14px;background:rgba(56,189,248,.06);border-radius:0 8px 8px 0">${esc(escNote)}</p>` : ''}

${section('Handoffs', handoffRows || '<p style="color:#55678c">Nenhum handoff nesta onda.</p>')}
${section('Dossiês de auditoria', auditList)}
${section('Revisões', reviewList)}
${section('Decisões humanas', decisionList)}

<footer style="margin-top:48px;padding-top:16px;border-top:1px solid #1a2a4a;font:11px ui-monospace,monospace;color:#55678c">CENTRAL-DE-AUDITORIA-E-HANDOFFS · export executivo F4 · ${concluido} concluído(s), ${reprovado} reprovado(s), ${bloqueado} bloqueado(s)</footer>
</body></html>`;
}
