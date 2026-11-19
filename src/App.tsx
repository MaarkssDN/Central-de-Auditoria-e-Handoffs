import { useEffect, useState } from 'react';
import { AgentBotsWorkspace } from './components/AgentBotsWorkspace';
import { AgentsRosterView } from './components/AgentsRosterView';
import { AuditReviewView } from './components/AuditReviewView';
import { CentralAuditView } from './components/CentralAuditView';
import { ConnectRepoModal } from './components/ConnectRepoModal';
import { HandoffsCenterView } from './components/HandoffsCenterView';
import { RepositoriesView } from './components/RepositoriesView';
import { Sidebar, type NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';
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
  WorkspaceState,
} from './types/governance';
import { buildGatesForRepoScripts } from './utils/governanceEngine';

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('bots');
  const [selectedBotAgentId, setSelectedBotAgentId] = useState<string>('00');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  useEffect(() => {
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
  }, []);

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

  if (loading || !workspace) {
    return (
      <div className="min-h-screen blueprint-grid flex items-center justify-center p-6 bg-ink-950">
        <div className="panel panel-corner p-6 w-full max-w-md space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="led led-warn animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-400">
              Inicializando console…
            </span>
          </div>
          <div className="h-5 w-48 bg-ink-800 rounded animate-pulse" />
          <div className="h-4 w-full bg-ink-800/70 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-ink-800/70 rounded animate-pulse" />
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
            r.id === existing.id ? { ...repo, id: existing.id, blockers: r.blockers } : r
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
  }

  function handleUpdateGateStatus(
    waveId: string,
    gateId: string,
    status: GateStatus,
    notes?: string
  ) {
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
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
          {loadError && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              {loadError} Operando com estado inicial local.
            </div>
          )}

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
            />
          )}
        </main>
      </div>

      <ConnectRepoModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onAddRepository={handleAddRepository}
      />
    </div>
  );
}
