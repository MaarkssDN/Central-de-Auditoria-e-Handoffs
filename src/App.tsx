import { useEffect, useState } from 'react';
import { AgentBotsWorkspace } from './components/AgentBotsWorkspace';
import { AgentsRosterView } from './components/AgentsRosterView';
import { AuditReviewView } from './components/AuditReviewView';
import { CentralAuditView } from './components/CentralAuditView';
import { ChatBootWidget } from './components/ChatBootWidget';
import { ConnectRepoModal } from './components/ConnectRepoModal';
import { DashboardView } from './components/DashboardView';
import { FilesView } from './components/FilesView';
import { HandoffsCenterView } from './components/HandoffsCenterView';
import { LoginModal } from './components/LoginModal';
import { ProvidersView } from './components/ProvidersView';
import { RepositoriesView } from './components/RepositoriesView';
import { Sidebar, type NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import type { ThemeMode } from './components/ThemeToggle';
import { WaveOrchestratorView } from './components/WaveOrchestratorView';
import { createSeedWorkspace } from './data/seedWorkspace';
import type {
  BlockerStatus,
  GateStatus,
  Handoff,
  IndependentReview,
  Mission,
  RepositoryTarget,
  Wave,
  WebhookIntegration,
  WorkspaceState,
} from './types/governance';
import { buildGatesForRepoScripts } from './utils/governanceEngine';
import type { WebhookEventType } from './utils/webhookNotifier';

const THEME_KEY = '@central-auditoria:theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === 'dark' || saved === 'light' ? saved : 'dark';
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webhookNotice, setWebhookNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [userName, setUserName] = useState('Operador');
  const [selectedBotAgentId, setSelectedBotAgentId] = useState<string>('00');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch { /* storage indisponível */ }
  }, [theme]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (r) => {
        setAuthenticated(r.ok);
        if (r.ok) {
          const data = (await r.json().catch(() => null)) as { user?: { name?: string } } | null;
          if (data?.user?.name) setUserName(data.user.name);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json().catch(() => null)) as { user?: { name?: string } } | null;
        if (data?.user?.name) setUserName(data.user.name);
      })
      .catch(() => {});
  }, [authenticated]);

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      setAuthenticated(false);
      setWorkspace(null);
      setLoading(true);
    });
  }

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/workspace');
        if (!res.ok) throw new Error('Falha ao carregar estado de governança.');
        const data = (await res.json()) as WorkspaceState;
        if (!cancelled) {
          setWorkspace(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Erro desconhecido.');
          setWorkspace(createSeedWorkspace());
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  function commitWorkspace(updater: (prev: WorkspaceState) => WorkspaceState) {
    setWorkspace((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {
        // Persist best-effort when offline
      });
      return next;
    });
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#03050B] text-[#94A3B8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-white/10 border-t-[#00E5FF] animate-spin" />
          <span className="text-xs tracking-wide text-[#94A3B8]">Verificando sessão…</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <LoginModal
        onSuccess={() => {
          setAuthenticated(true);
          setLoading(true);
        }}
      />
    );
  }

  if (loading || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#03050B] text-[#94A3B8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-white/10 border-t-[#00E5FF] animate-spin" />
          <span className="text-xs tracking-wide text-[#94A3B8]">Inicializando console…</span>
        </div>
      </div>
    );
  }

  const activeRepo =
    workspace.repositories.find((r) => r.id === workspace.activeRepoId) ??
    workspace.repositories[0];

  const repoWaves = workspace.waves.filter((w) => w.repoId === activeRepo?.id);
  const repoMissions = workspace.missions.filter((m) => m.repoId === activeRepo?.id);
  const repoHandoffs = workspace.handoffs.filter((h) => h.repoId === activeRepo?.id);
  const repoReviews = workspace.reviews.filter((r) => r.repoId === activeRepo?.id);
  const currentWave = repoWaves[repoWaves.length - 1];

  const openHandoffsCount = repoHandoffs.filter((h) => h.status !== 'resolvido').length;
  const pendingAuditCount = repoReviews.filter((r) => r.verdict !== 'APROVADO').length;

  function handleSelectRepo(repoId: string) {
    commitWorkspace((prev) => ({
      ...prev,
      activeRepoId: repoId,
    }));
  }

  function handleAddRepository(repo: RepositoryTarget, initialWave: Wave) {
    commitWorkspace((prev) => {
      const exists = prev.repositories.some((r) => r.fullName === repo.fullName);
      if (exists) {
        const existing = prev.repositories.find((r) => r.fullName === repo.fullName)!;
        return {
          ...prev,
          activeRepoId: existing.id,
          repositories: prev.repositories.map((r) =>
            r.id === existing.id
              ? { ...repo, id: existing.id, blockers: r.blockers, webhook: r.webhook }
              : r
          ),
        };
      }
      return {
        ...prev,
        activeRepoId: repo.id,
        repositories: [...prev.repositories, repo],
        waves: [...prev.waves, initialWave],
      };
    });
  }

  async function triggerRepoWebhook(
    repo: RepositoryTarget | undefined,
    params: {
      eventType: WebhookEventType;
      title: string;
      details: string;
      severity: 'info' | 'warning' | 'critical';
    }
  ) {
    const hook = repo?.webhook;
    if (!repo || !hook || !hook.enabled) return;
    if (params.eventType === 'handoff_created' && !hook.notifyOnHandoff) return;
    if (params.eventType === 'audit_failure' && !hook.notifyOnAuditFailure) return;

    try {
      const res = await fetch('/api/webhooks/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: hook.provider,
          url: hook.url,
          eventType: params.eventType,
          repoFullName: repo.fullName,
          title: params.title,
          details: params.details,
          severity: params.severity,
          channelLabel: hook.channelLabel,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        setWebhookNotice({
          kind: 'ok',
          text: `Webhook (${hook.provider === 'slack' ? 'Slack' : 'Discord'}) notificado para ${repo.fullName}: ${params.title}`,
        });
      } else {
        setWebhookNotice({
          kind: 'error',
          text: `Falha ao disparar webhook de ${repo.fullName}: ${data.error || `HTTP ${res.status}`}`,
        });
      }
    } catch {
      setWebhookNotice({
        kind: 'error',
        text: `Erro de rede ao disparar webhook automático para ${repo.fullName}.`,
      });
    }
  }

  function handleUpdateRepoWebhook(repoId: string, webhook: WebhookIntegration | undefined) {
    commitWorkspace((prev) => ({
      ...prev,
      repositories: prev.repositories.map((r) =>
        r.id === repoId
          ? {
              ...r,
              webhook,
            }
          : r
      ),
    }));
  }

  async function handleSyncGitHubRepo(repo: RepositoryTarget): Promise<string | null> {
    try {
      const res = await fetch('/api/github/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoInput: repo.fullName }),
      });
      const data = (await res.json()) as {
        error?: string;
        repository?: RepositoryTarget;
      };
      if (!res.ok || !data.repository) {
        return data.error || 'Erro ao sincronizar repositório.';
      }
      const synced = data.repository;
      commitWorkspace((prev) => ({
        ...prev,
        repositories: prev.repositories.map((r) =>
          r.id === repo.id
            ? {
                ...synced,
                id: repo.id,
                blockers: r.blockers,
                webhook: r.webhook,
              }
            : r
        ),
        waves: prev.waves.map((w) =>
          w.repoId === repo.id
            ? {
                ...w,
                gates: buildGatesForRepoScripts(synced.packageScripts),
              }
            : w
        ),
      }));
      return null;
    } catch {
      return 'Falha de rede ao sincronizar repositório.';
    }
  }

  function handleRemoveRepo(repoId: string) {
    commitWorkspace((prev) => {
      const remaining = prev.repositories.filter((r) => r.id !== repoId);
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        activeRepoId: prev.activeRepoId === repoId ? remaining[0].id : prev.activeRepoId,
        repositories: remaining,
        waves: prev.waves.filter((w) => w.repoId !== repoId),
        missions: prev.missions.filter((m) => m.repoId !== repoId),
        handoffs: prev.handoffs.filter((h) => h.repoId !== repoId),
        reviews: prev.reviews.filter((r) => r.repoId !== repoId),
      };
    });
  }

  function handleCreateWave(wave: Wave) {
    commitWorkspace((prev) => ({
      ...prev,
      waves: [...prev.waves, wave],
    }));
  }

  function handleUpdateWave(updated: Wave) {
    commitWorkspace((prev) => ({
      ...prev,
      waves: prev.waves.map((w) => (w.id === updated.id ? updated : w)),
    }));
  }

  function handleCreateMission(mission: Mission) {
    commitWorkspace((prev) => ({
      ...prev,
      missions: [...prev.missions, mission],
    }));
  }

  function handleToggleMissionStep(missionId: string, stepIndex: number) {
    commitWorkspace((prev) => ({
      ...prev,
      missions: prev.missions.map((m) =>
        m.id === missionId
          ? {
              ...m,
              plan: m.plan.map((s, idx) =>
                idx === stepIndex ? { ...s, completed: !s.completed } : s
              ),
            }
          : m
      ),
    }));
  }

  function handleCreateHandoff(handoff: Handoff) {
    commitWorkspace((prev) => ({
      ...prev,
      handoffs: [handoff, ...prev.handoffs],
    }));
    const targetRepo = workspace?.repositories.find((r) => r.id === handoff.repoId);
    void triggerRepoWebhook(targetRepo, {
      eventType: 'handoff_created',
      title: `Handoff ${handoff.fromAgentId} → ${handoff.toAgentId} (${handoff.priority.toUpperCase()})`,
      details: `${handoff.problem} | Mudança solicitada: ${handoff.requiredChange}`,
      severity: handoff.priority === 'bloqueador' ? 'critical' : 'warning',
    });
  }

  function handleUpdateHandoff(updated: Handoff) {
    commitWorkspace((prev) => ({
      ...prev,
      handoffs: prev.handoffs.map((h) => (h.id === updated.id ? updated : h)),
    }));
  }

  function handleCreateReview(review: IndependentReview) {
    commitWorkspace((prev) => ({
      ...prev,
      reviews: [review, ...prev.reviews],
      missions: prev.missions.map((m) =>
        m.id === review.missionId
          ? {
              ...m,
              status: review.verdict === 'APROVADO' ? 'aprovada' : 'reprovada',
            }
          : m
      ),
    }));
    if (review.verdict === 'REPROVADO' || review.verdict === 'BLOQUEADO') {
      const targetRepo = workspace?.repositories.find((r) => r.id === review.repoId);
      void triggerRepoWebhook(targetRepo, {
        eventType: 'audit_failure',
        title: `Parecer 24 ${review.verdict}: ${review.missionTitle}`,
        details: `Autor: Agente ${review.authorAgentId} · Hash: ${review.commitOrHashes} · Evidência: ${review.evidence}`,
        severity: 'critical',
      });
    }
  }

  function handleUpdateGateStatus(
    waveId: string,
    gateId: string,
    status: GateStatus,
    notes?: string
  ) {
    const targetWave = workspace?.waves.find((w) => w.id === waveId);
    const targetGate = targetWave?.gates.find((g) => g.id === gateId);
    commitWorkspace((prev) => ({
      ...prev,
      waves: prev.waves.map((w) =>
        w.id === waveId
          ? {
              ...w,
              gates: w.gates.map((g) =>
                g.id === gateId
                  ? {
                      ...g,
                      status,
                      lastRunAt: new Date().toISOString(),
                      notes: notes ?? g.notes,
                    }
                  : g
              ),
            }
          : w
      ),
    }));
    if (status === 'FALHOU' && targetWave && targetGate) {
      const targetRepo = workspace?.repositories.find((r) => r.id === targetWave.repoId);
      void triggerRepoWebhook(targetRepo, {
        eventType: 'audit_failure',
        title: `Falha no Gate ${targetGate.command} (${targetWave.name})`,
        details: notes || `O gate obrigatório ${targetGate.command} falhou e bloqueia a transição da onda.`,
        severity: 'critical',
      });
    }
  }

  function handleUpdateBlockerStatus(
    repoId: string,
    code: string,
    status: BlockerStatus,
    evidenceNote?: string
  ) {
    commitWorkspace((prev) => ({
      ...prev,
      repositories: prev.repositories.map((r) =>
        r.id === repoId
          ? {
              ...r,
              blockers: r.blockers.map((b) =>
                b.code === code
                  ? {
                      ...b,
                      status,
                      evidenceNote: evidenceNote ?? b.evidenceNote,
                    }
                  : b
              ),
            }
          : r
      ),
    }));
  }

  return (
    <div className="min-h-screen flex bg-ink-950 text-paper-100 blueprint-grid">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        openHandoffsCount={openHandoffsCount}
        pendingAuditCount={pendingAuditCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <TopBar
          activeSection={activeSection}
          repositories={workspace.repositories}
          activeRepoId={workspace.activeRepoId}
          onSelectRepo={handleSelectRepo}
          onOpenConnectRepo={() => setConnectModalOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
          {loadError && (
            <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              {loadError} Operando com estado inicial local.
            </div>
          )}

          {webhookNotice && (
            <div
              className="mb-6 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 border"
              style={{
                background:
                  webhookNotice.kind === 'ok'
                    ? 'rgba(0, 255, 163, 0.08)'
                    : 'rgba(255, 7, 58, 0.1)',
                borderColor:
                  webhookNotice.kind === 'ok'
                    ? 'rgba(0, 255, 163, 0.42)'
                    : 'rgba(255, 7, 58, 0.45)',
                color: webhookNotice.kind === 'ok' ? '#7FFFD4' : '#FF8FA3',
              }}
            >
              <span>{webhookNotice.text}</span>
              <button
                type="button"
                onClick={() => setWebhookNotice(null)}
                className="text-xs underline underline-offset-4 shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          {activeSection === 'home' && workspace && (
            <DashboardView
              workspace={workspace}
              userName={userName}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'providers' && <ProvidersView />}

          {activeSection === 'arquivos' && <FilesView />}

          {activeSection === 'central' && <CentralAuditView />}

          {activeSection === 'ondas' && (
            <WaveOrchestratorView
              activeRepo={activeRepo}
              waves={repoWaves}
              missions={repoMissions}
              handoffs={repoHandoffs}
              reviews={repoReviews}
              onCreateWave={handleCreateWave}
              onUpdateWave={handleUpdateWave}
              onCreateMission={handleCreateMission}
              onToggleMissionStep={handleToggleMissionStep}
              onActivateBot={(agentId) => {
                setSelectedBotAgentId(agentId);
                setActiveSection('bots');
              }}
            />
          )}

          {activeSection === 'bots' && (
            <AgentBotsWorkspace
              activeRepo={activeRepo}
              activeWave={currentWave}
              workspace={workspace}
              selectedAgentId={selectedBotAgentId}
              onSelectAgent={setSelectedBotAgentId}
              onReplaceWorkspace={(next) => setWorkspace(next)}
            />
          )}

          {activeSection === 'handoffs' && activeRepo && (
            <HandoffsCenterView
              repoId={activeRepo.id}
              waves={repoWaves}
              handoffs={repoHandoffs}
              onCreateHandoff={handleCreateHandoff}
              onUpdateHandoff={handleUpdateHandoff}
              onActivateBot={(agentId) => {
                setSelectedBotAgentId(agentId);
                setActiveSection('bots');
              }}
            />
          )}

          {activeSection === 'auditoria' && (
            <AuditReviewView
              activeRepo={activeRepo}
              activeWave={currentWave}
              missions={repoMissions}
              reviews={repoReviews}
              onCreateReview={handleCreateReview}
              onUpdateGateStatus={handleUpdateGateStatus}
              onUpdateBlockerStatus={handleUpdateBlockerStatus}
              onActivateBot={(agentId) => {
                setSelectedBotAgentId(agentId);
                setActiveSection('bots');
              }}
            />
          )}

          {activeSection === 'agentes' && (
            <AgentsRosterView
              activeRepo={activeRepo}
              onActivateBot={(agentId) => {
                setSelectedBotAgentId(agentId);
                setActiveSection('bots');
              }}
            />
          )}

          {activeSection === 'repositorios' && (
            <RepositoriesView
              repositories={workspace.repositories}
              activeRepoId={workspace.activeRepoId}
              onSelectRepo={handleSelectRepo}
              onOpenConnectModal={() => setConnectModalOpen(true)}
              onSyncGitHubRepo={handleSyncGitHubRepo}
              onRemoveRepo={handleRemoveRepo}
              onUpdateRepoWebhook={handleUpdateRepoWebhook}
            />
          )}
        </main>
      </div>

      <ConnectRepoModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onAddRepository={handleAddRepository}
      />
      <ChatBootWidget />
    </div>
  );
}
