import { DEFAULT_PRIORITY_BLOCKERS } from './agentsRoster';
import type { RepositoryTarget, Wave, WorkspaceState } from '../types/governance';
import { buildGatesForRepoScripts } from '../utils/governanceEngine';

export function createSeedWorkspace(): WorkspaceState {
  const repoId = 'repo-birthub-360';
  const now = new Date().toISOString();

  const repository: RepositoryTarget = {
    id: repoId,
    name: 'Birthub-360',
    fullName: 'Birthub-360',
    sourceType: 'manual',
    defaultBranch: 'main',
    branches: ['main'],
    detectedAgentsMd: true,
    packageScripts: {},
    samplePaths: [],
    existingHandoffFiles: [],
    existingReviewFiles: [],
    lastSyncedAt: now,
    blockers: DEFAULT_PRIORITY_BLOCKERS.map((b) => ({ ...b, status: 'aberto' })),
  };

  const wave: Wave = {
    id: `wave-${repoId}-1`,
    repoId,
    number: 1,
    name: 'Onda 1 — Release Readiness',
    integrationBranch: 'integracao/onda-1',
    state: 'PLANEJADA',
    scopeFreezeActive: true,
    activeAgentIds: ['00'],
    mergesSinceLastGate: 0,
    gates: buildGatesForRepoScripts({}),
    createdAt: now,
  };

  return {
    activeRepoId: repoId,
    repositories: [repository],
    waves: [wave],
    missions: [],
    handoffs: [],
    reviews: [],
    botMessages: [],
  };
}
