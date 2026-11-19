import { useEffect, useState } from 'react';
import { Clapperboard, Film, MonitorPlay, Users, Camera, ArrowRight, Lock } from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

// ── Mundo visual: set de filmagem ─────────────────────────────────────────
// A central de auditoria É o escritório de continuidade de um set:
// call sheet despacha, claquete marca o handoff, script supervisor audita.

const DAY_ROWS: Array<{ time: string; scene: string; action: string; crew: string }> = [
  { time: '06:00', scene: 'INT. FILA DE HANDOFFS — NOITE', action: 'Coordenador abre a onda e despacha os handoffs por prioridade, dependência e slot.', crew: 'Agente 00' },
  { time: '09:00', scene: 'EXT. WORKTREES — DIA', action: 'Cada agente trabalha em worktree e branch próprios, sem pisar no set do vizinho.', crew: 'Todos' },
  { time: '12:00', scene: 'INT. PROVIDERS — TARDE', action: 'Codex, Claude, Gemini, Copilot, Grok e Devin entram em cena — CLI ou API, com chave ou pacote de prompt.', crew: '8 providers' },
  { time: '15:00', scene: 'INT. PARECER 24 — FIM DE TARDE', action: 'Revisão independente julga diff real vs. escopo declarado: APROVADO, REPROVADO ou BLOQUEADO.', crew: 'Agente 24' },
  { time: '18:00', scene: 'EXT. AUDITORIA — ENTARDECER', action: 'Gates, bloqueios e trilha de execução fecham a diária. Nada passa sem evidência.', crew: 'Central' },
];

const EQUIPMENT: Array<{ name: string; kind: string; note: string }> = [
  { name: 'OpenAI Codex', kind: 'CLI', note: 'codex exec no worktree do agente' },
  { name: 'Claude Code', kind: 'CLI', note: 'claude -p no worktree' },
  { name: 'GitHub Copilot', kind: 'CLI', note: 'detectado no terminal/VS Code' },
  { name: 'ChatGPT API', kind: 'API', note: 'chat completions com OPENAI_API_KEY' },
  { name: 'Gemini API', kind: 'API', note: 'generateContent com GEMINI_API_KEY' },
  { name: 'Grok (xAI)', kind: 'API', note: 'API compatível com OpenAI' },
  { name: 'Devin API', kind: 'API', note: 'cria sessões remotas de execução' },
  { name: 'Antigravity', kind: 'MANUAL', note: 'pacote de prompt em central/estado/fila' },
];

const CAST = OFFICIAL_AGENTS.slice(0, 12);

function useTimecode() {
  const [tc, setTc] = useState('00:00:00:00');
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const el = Date.now() - start;
      const h = String(Math.floor(el / 3600000) % 24).padStart(2, '0');
      const m = String(Math.floor(el / 60000) % 60).padStart(2, '0');
      const s = String(Math.floor(el / 1000) % 60).padStart(2, '0');
      const f = String(Math.floor((el / 1000) * 24) % 24).padStart(2, '0');
      setTc(`${h}:${m}:${s}:${f}`);
    }, 42);
    return () => clearInterval(id);
  }, []);
  return tc;
}

function Clapper() {
  return (
    <div className="film-clapper" aria-hidden="true">
      <div className="film-clapper-arm">
        <div className="film-clapper-stripes" />
      </div>
      <div className="film-clapper-body">
        <div className="film-slate-grid">
          <span>PROD</span><b>CENTRAL-360</b>
          <span>DIR</span><b>MARCELON</b>
          <span>SC</span><b>01</b>
          <span>TK</span><b>01</b>
          <span>DATE</span><b>19·11·26</b>
        </div>
      </div>
    </div>
  );
}

function MonitorMock() {
  return (
    <div className="film-monitor" aria-hidden="true">
      <div className="film-monitor-top">
        <span className="film-led film-led-rec" />
        <span className="film-monitor-title">MONITOR DE PRODUÇÃO — CHAT BOOT</span>
        <span className="film-monitor-tc">AO VIVO</span>
      </div>
      <div className="film-monitor-body">
        <div className="film-monitor-side">
          <div className="film-side-logo">CAH</div>
          {['Chat Boot', 'Conexões de IA', 'Arquivos', 'Bots', 'Handoffs', 'Auditoria'].map((l, i) => (
            <div key={l} className={`film-side-item${i === 0 ? ' is-on' : ''}`}>{l}</div>
          ))}
        </div>
        <div className="film-monitor-chat">
          <div className="film-bubble film-bubble-user">Despacha a onda release-readiness para os agentes disponíveis.</div>
          <div className="film-bubble film-bubble-agent">
            <b>Agente 00 · Núcleo</b>
            <p>Lote selecionado: 4 handoffs P1 despachados em worktrees próprias. Locks verificados, deps ok, provider devin.</p>
            <div className="film-bubble-tags">
              <span>DISPATCHED ×4</span><span>LOCK ok</span><span>WT ag-01…04</span>
            </div>
          </div>
          <div className="film-bubble film-bubble-system">Parecer 24 enfileirado para revisão independente.</div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const tc = useTimecode();
  const [typed, setTyped] = useState('');
  const logline = 'Uma central de governança multiagente: handoffs despachados, worktrees isoladas, execução em 8 providers e parecer independente — tudo auditado, tudo local.';

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(logline.slice(0, i));
      if (i >= logline.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [logline]);

  const year = new Date().getFullYear();

  return (
    <div className="film-root">
      {/* ── Topo ── */}
      <header className="film-top">
        <div className="film-brand">
          <span className="film-brand-mark"><Clapperboard className="w-4 h-4" strokeWidth={2.2} /></span>
          <span className="film-brand-name">CENTRAL DE AUDITORIA <em>E HANDOFFS</em></span>
        </div>
        <div className="film-top-right">
          <span className="film-top-tc">TC {tc}</span>
          <button type="button" className="film-btn film-btn-tally" onClick={onEnter}>
            <Lock className="w-3.5 h-3.5" /> Acesso restrito
          </button>
        </div>
      </header>

      {/* ── Hero / 1º take ── */}
      <section className="film-hero">
        <div className="film-hero-grid">
          <div className="film-hero-copy">
            <p className="film-slug">SCENE 01 — INT. PAINEL DE PRODUÇÃO — NOITE</p>
            <h1 className="film-headline">
              A central que <span>dirige</span> seus agentes de IA.
            </h1>
            <p className="film-logline"><span className="film-type-caret">▌</span>{typed}</p>
            <div className="film-hero-actions">
              <button type="button" className="film-btn film-btn-tally film-btn-lg" onClick={onEnter}>
                <span className="film-rec-dot" /> Entrar no set
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#ordem-do-dia" className="film-btn film-btn-ghost">Ver a ordem do dia</a>
            </div>
            <p className="film-hero-note">Console local · login único · seus repos, seus agentes, sua máquina.</p>
          </div>
          <div className="film-hero-visual">
            <Clapper />
          </div>
        </div>
        <div className="film-marquee" aria-hidden="true">
          <div className="film-marquee-track">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k} className="film-marquee-run">
                {CAST.map((a) => `${a.id} · ${a.persona.codename.toUpperCase()}`).join('  ◆  ')}  ◆  AGENTE 24 · REVISÃO INDEPENDENTE  ◆  
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ordem do dia (call sheet) ── */}
      <section id="ordem-do-dia" className="film-section">
        <div className="film-section-head">
          <p className="film-slug">SCENE 02 — CALL SHEET</p>
          <h2 className="film-h2"><Film className="w-6 h-6" /> A ordem do dia de uma onda</h2>
          <p className="film-sub">Do despacho ao parecer, cada etapa tem dono, horário e evidência — como uma diária de verdade.</p>
        </div>
        <div className="film-callsheet">
          <div className="film-callsheet-head">
            <span>CALL SHEET — ORDEM DO DIA</span>
            <span>PRODUÇÃO 360 · REQUIZIÇÃO DE FÔLEGO: NÃO</span>
          </div>
          <div className="film-callsheet-rows">
            {DAY_ROWS.map((r) => (
              <div key={r.time} className="film-call-row">
                <span className="film-call-time">{r.time}</span>
                <div className="film-call-main">
                  <b>{r.scene}</b>
                  <p>{r.action}</p>
                </div>
                <span className="film-call-crew">{r.crew}</span>
              </div>
            ))}
          </div>
          <div className="film-callsheet-foot">
            <span>✂ Perfuração de borda — não rasgar</span>
            <span>24 FPS · TAKE ÚNICO POR HANDOFF</span>
          </div>
        </div>
      </section>

      {/* ── Elenco ── */}
      <section className="film-section">
        <div className="film-section-head">
          <p className="film-slug">SCENE 03 — ELENCO</p>
          <h2 className="film-h2"><Users className="w-6 h-6" /> {OFFICIAL_AGENTS.length} agentes sob contrato</h2>
          <p className="film-sub">Cada um com codinome, arquétipo, voz e propriedade exclusiva de arquivos. Slots 19 e 20 reservados; o 24 é o script supervisor.</p>
        </div>
        <div className="film-cast">
          {CAST.map((a) => (
            <div key={a.id} className="film-cast-row">
              <span className="film-cast-id" style={{ color: a.persona.accentHex }}>{a.id}</span>
              <div className="film-cast-who">
                <b>{a.persona.codename}</b>
                <span>{a.name}</span>
              </div>
              <span className="film-cast-role">{a.persona.archetype}</span>
              <span className="film-cast-motto">“{a.persona.motto}”</span>
            </div>
          ))}
          <div className="film-cast-more">
            + {OFFICIAL_AGENTS.length - CAST.length} agentes no roster oficial — incluindo o Agente 24, Revisão Independente, que nenhum executor pode ser.
          </div>
        </div>
      </section>

      {/* ── Equipamento ── */}
      <section className="film-section">
        <div className="film-section-head">
          <p className="film-slug">SCENE 04 — EQUIPAMENTO</p>
          <h2 className="film-h2"><Camera className="w-6 h-6" /> O set inteiro cabe em 8 providers</h2>
          <p className="film-sub">A central detecta CLIs na sua máquina, usa APIs com chave configurada e gera pacote de prompt quando não há integração headless.</p>
        </div>
        <div className="film-equipment">
          {EQUIPMENT.map((e) => (
            <div key={e.name} className="film-eq-card">
              <div className="film-eq-top">
                <b>{e.name}</b>
                <span className={`film-kind film-kind-${e.kind.toLowerCase()}`}>{e.kind}</span>
              </div>
              <p>{e.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Rushes: prova ── */}
      <section className="film-section">
        <div className="film-section-head">
          <p className="film-slug">SCENE 05 — RUSHES</p>
          <h2 className="film-h2"><MonitorPlay className="w-6 h-6" /> Olha a diária do Chat Boot</h2>
          <p className="film-sub">O coordenador recebe a missão em linguagem natural, monta o lote respeitando locks e dependências, e enfileira a revisão do 24.</p>
        </div>
        <MonitorMock />
      </section>

      {/* ── CTA final ── */}
      <section className="film-final">
        <p className="film-slug">ÚLTIMA CENA — ACTION!</p>
        <h2 className="film-final-h">Cortina. É a sua vez de dirigir.</h2>
        <button type="button" className="film-btn film-btn-tally film-btn-xl" onClick={onEnter}>
          <span className="film-rec-dot" /> Entrar na central
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="film-final-note">Acesso local · sessão neste dispositivo · senha inicial definida no primeiro boot.</p>
      </section>

      <footer className="film-footer">
        <span>CAH·360 — Governança Multiagente</span>
        <span>© {year} · Produzido localmente, sem estúdio</span>
      </footer>
    </div>
  );
}
