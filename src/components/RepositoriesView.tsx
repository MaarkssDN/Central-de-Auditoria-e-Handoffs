import { useEffect, useState, type FormEvent } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  FolderGit2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Unlink,
  Webhook,
  XCircle,
} from 'lucide-react';
import type {
  RepositoryTarget,
  WebhookIntegration,
  WebhookProvider,
} from '../types/governance';
import { resolveFileOwnership } from '../utils/governanceEngine';
import { validateWebhookConfig } from '../utils/webhookNotifier';

interface RepositoriesViewProps {
  repositories: RepositoryTarget[];
  activeRepoId: string;
  onSelectRepo: (repoId: string) => void;
  onOpenConnectModal: () => void;
  onSyncGitHubRepo: (repo: RepositoryTarget) => Promise<string | null>;
  onRemoveRepo: (repoId: string) => void;
  onUpdateRepoWebhook: (repoId: string, webhook: WebhookIntegration | undefined) => void;
}

export function RepositoriesView({
  repositories,
  activeRepoId,
  onSelectRepo,
  onOpenConnectModal,
  onSyncGitHubRepo,
  onRemoveRepo,
  onUpdateRepoWebhook,
}: RepositoriesViewProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [configRepoId, setConfigRepoId] = useState<string>(activeRepoId);
  const targetRepo =
    repositories.find((r) => r.id === configRepoId) ??
    repositories.find((r) => r.id === activeRepoId) ??
    repositories[0];

  const [provider, setProvider] = useState<WebhookProvider>(
    targetRepo?.webhook?.provider ?? 'slack'
  );
  const [webhookUrl, setWebhookUrl] = useState<string>(targetRepo?.webhook?.url ?? '');
  const [channelLabel, setChannelLabel] = useState<string>(
    targetRepo?.webhook?.channelLabel ?? ''
  );
  const [enabled, setEnabled] = useState<boolean>(targetRepo?.webhook?.enabled ?? true);
  const [notifyOnHandoff, setNotifyOnHandoff] = useState<boolean>(
    targetRepo?.webhook?.notifyOnHandoff ?? true
  );
  const [notifyOnAuditFailure, setNotifyOnAuditFailure] = useState<boolean>(
    targetRepo?.webhook?.notifyOnAuditFailure ?? true
  );

  const [webhookFeedback, setWebhookFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const activeRepo = repositories.find((r) => r.id === activeRepoId);

  useEffect(() => {
    setConfigRepoId(activeRepoId);
  }, [activeRepoId]);

  useEffect(() => {
    if (!targetRepo) return;
    setProvider(targetRepo.webhook?.provider ?? 'slack');
    setWebhookUrl(targetRepo.webhook?.url ?? '');
    setChannelLabel(targetRepo.webhook?.channelLabel ?? '');
    setEnabled(targetRepo.webhook?.enabled ?? true);
    setNotifyOnHandoff(targetRepo.webhook?.notifyOnHandoff ?? true);
    setNotifyOnAuditFailure(targetRepo.webhook?.notifyOnAuditFailure ?? true);
    setWebhookFeedback(null);
  }, [targetRepo?.id, targetRepo?.webhook?.url, targetRepo?.webhook?.provider]);

  async function handleSync(repo: RepositoryTarget) {
    setSyncError(null);
    setSyncingId(repo.id);
    const err = await onSyncGitHubRepo(repo);
    setSyncingId(null);
    if (err) setSyncError(err);
  }

  function handleSaveWebhook(e: FormEvent) {
    e.preventDefault();
    if (!targetRepo) return;
    setWebhookFeedback(null);

    const check = validateWebhookConfig(provider, webhookUrl);
    if (!check.valid || !check.normalizedUrl) {
      setWebhookFeedback({
        kind: 'error',
        text: check.error || 'URL de webhook inválida.',
      });
      return;
    }

    const updatedWebhook: WebhookIntegration = {
      provider,
      url: check.normalizedUrl,
      channelLabel: channelLabel.trim() || undefined,
      enabled,
      notifyOnHandoff,
      notifyOnAuditFailure,
      lastTestedAt: targetRepo.webhook?.lastTestedAt,
      lastTestStatus: targetRepo.webhook?.lastTestStatus,
      lastTestMessage: targetRepo.webhook?.lastTestMessage,
    };

    onUpdateRepoWebhook(targetRepo.id, updatedWebhook);
    setWebhookFeedback({
      kind: 'success',
      text: `Webhook ${provider === 'slack' ? 'Slack' : 'Discord'} salvo para ${targetRepo.fullName}.`,
    });
  }

  async function handleTestWebhook() {
    if (!targetRepo) return;
    setWebhookFeedback(null);

    const check = validateWebhookConfig(provider, webhookUrl);
    if (!check.valid || !check.normalizedUrl) {
      setWebhookFeedback({
        kind: 'error',
        text: check.error || 'Informe uma URL HTTPS válida antes de testar.',
      });
      return;
    }

    setTestingWebhook(true);
    try {
      const res = await fetch('/api/webhooks/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          url: check.normalizedUrl,
          eventType: 'test',
          repoFullName: targetRepo.fullName,
          title: 'Teste de Conexão · Central de Auditoria e Handoffs',
          details: `Notificações automáticas configuradas para ${targetRepo.fullName} (Handoffs: ${notifyOnHandoff ? 'Sim' : 'Não'} | Falhas de Auditoria: ${notifyOnAuditFailure ? 'Sim' : 'Não'}).`,
          severity: 'info',
          channelLabel: channelLabel.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      const now = new Date().toISOString();

      if (res.ok && data.ok) {
        const msg =
          data.message ||
          `Notificação entregue com sucesso ao ${provider === 'slack' ? 'Slack' : 'Discord'}.`;
        onUpdateRepoWebhook(targetRepo.id, {
          provider,
          url: check.normalizedUrl,
          channelLabel: channelLabel.trim() || undefined,
          enabled,
          notifyOnHandoff,
          notifyOnAuditFailure,
          lastTestedAt: now,
          lastTestStatus: 'ok',
          lastTestMessage: msg,
        });
        setWebhookFeedback({ kind: 'success', text: msg });
      } else {
        const errMsg = data.error || `Falha no disparo de teste (HTTP ${res.status}).`;
        if (targetRepo.webhook) {
          onUpdateRepoWebhook(targetRepo.id, {
            ...targetRepo.webhook,
            provider,
            url: check.normalizedUrl,
            channelLabel: channelLabel.trim() || undefined,
            enabled,
            notifyOnHandoff,
            notifyOnAuditFailure,
            lastTestedAt: now,
            lastTestStatus: 'error',
            lastTestMessage: errMsg,
          });
        }
        setWebhookFeedback({ kind: 'error', text: errMsg });
      }
    } catch {
      setWebhookFeedback({
        kind: 'error',
        text: 'Erro de rede ao contactar /api/webhooks/dispatch.',
      });
    } finally {
      setTestingWebhook(false);
    }
  }

  function handleDisconnectWebhook() {
    if (!targetRepo) return;
    onUpdateRepoWebhook(targetRepo.id, undefined);
    setWebhookUrl('');
    setChannelLabel('');
    setWebhookFeedback({
      kind: 'success',
      text: `Integração de Webhook removida de ${targetRepo.fullName}.`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-accent-amber">
            Repositórios sob Orquestração
          </h2>
          <p className="text-sm text-accent-amber/70 mt-1 max-w-2xl">
            Alterne o contexto ativo, conecte qualquer repositório GitHub/local e configure Webhooks Slack ou Discord por repositório.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="btn btn-primary !rounded-2xl !px-4 !py-2.5 text-sm whitespace-nowrap shrink-0"
        >
          Conectar Novo Repositório
        </button>
      </div>

      {syncError && (
        <div
          className="rounded-2xl p-3.5 text-sm border"
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            borderColor: 'rgba(220, 38, 38, 0.45)',
            color: '#DC2626',
          }}
        >
          {syncError}
        </div>
      )}

      {/* Repositories Table */}
      <div className="panel !rounded-3xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3.5 px-5">Repositório</th>
              <th className="py-3.5 px-4">Origem</th>
              <th className="py-3.5 px-4">AGENTS.md</th>
              <th className="py-3.5 px-4">Webhook</th>
              <th className="py-3.5 px-4 text-right">Scripts</th>
              <th className="py-3.5 px-4 text-right">Arquivos</th>
              <th className="py-3.5 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {repositories.map((repo) => {
              const isActive = repo.id === activeRepoId;
              const hook = repo.webhook;
              return (
                <tr key={repo.id} className={isActive ? 'bg-slate-50/80' : 'hover:bg-slate-50'}>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <FolderGit2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <span className="font-mono">{repo.fullName}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      Branch padrão: {repo.defaultBranch} · {repo.branches.length} branch(es)
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {repo.sourceType === 'github' ? 'GitHub API' : 'Configuração Manual'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={
                        repo.detectedAgentsMd
                          ? 'text-emerald-700 font-medium'
                          : 'text-amber-700 font-medium'
                      }
                    >
                      {repo.detectedAgentsMd ? 'Detectado' : 'Não detectado'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {hook ? (
                      <button
                        type="button"
                        onClick={() => setConfigRepoId(repo.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors"
                        style={{
                          borderColor: hook.enabled
                            ? hook.provider === 'slack'
                              ? 'rgba(5, 150, 105, 0.5)'
                              : 'rgba(124, 58, 237, 0.6)'
                            : 'rgba(148, 163, 184, 0.35)',
                          background: hook.enabled
                            ? hook.provider === 'slack'
                              ? 'rgba(5, 150, 105, 0.12)'
                              : 'rgba(124, 58, 237, 0.16)'
                            : 'rgba(148, 163, 184, 0.08)',
                          color: hook.enabled
                            ? hook.provider === 'slack'
                              ? '#047857'
                              : '#7C3AED'
                            : '#94A3B8',
                        }}
                      >
                        <Webhook className="w-3.5 h-3.5" />
                        <span>
                          {hook.provider === 'slack' ? 'Slack' : 'Discord'} ·{' '}
                          {hook.enabled ? 'Ativo' : 'Pausado'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfigRepoId(repo.id)}
                        className="text-xs text-paper-400 hover:text-[#2563EB] underline underline-offset-4"
                      >
                        Configurar
                      </button>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {Object.keys(repo.packageScripts).length}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {repo.samplePaths.length}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#047857] px-2.5 py-1">
                          <Check className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectRepo(repo.id)}
                          className="h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-xl"
                        >
                          Selecionar
                        </button>
                      )}

                      {repo.sourceType === 'github' && (
                        <button
                          type="button"
                          onClick={() => handleSync(repo)}
                          disabled={syncingId === repo.id}
                          aria-label={`Sincronizar ${repo.fullName}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-xl"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${syncingId === repo.id ? 'animate-spin' : ''}`}
                          />
                        </button>
                      )}

                      {repositories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveRepo(repo.id)}
                          aria-label={`Remover ${repo.fullName}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Webhook Integrations Panel */}
      {targetRepo && (
        <section
          className="panel !rounded-3xl p-6 space-y-5"
          style={{
            borderColor: 'rgba(124, 58, 237, 0.42)',
            boxShadow: '0 18px 42px -20px rgba(124, 58, 237, 0.35)',
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(124, 58, 237, 0.25))',
                  border: '1px solid rgba(37, 99, 235, 0.45)',
                  color: 'var(--color-signal-400)',
                }}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-accent-amber">
                  Integrações de Webhook (Slack &amp; Discord)
                </h3>
                <p className="text-xs text-accent-amber/70 mt-0.5 max-w-2xl">
                  Conecte um Webhook HTTPS dedicado por repositório para disparar alertas automáticos ao criar novos Handoffs (§18) ou registrar falhas de Auditoria / Gates (§40).
                </p>
              </div>
            </div>

            <div className="w-full lg:w-72">
              <label
                htmlFor="webhook-repo-select"
                className="block text-[11px] font-semibold text-paper-300 mb-1"
              >
                Repositório configurado
              </label>
              <select
                id="webhook-repo-select"
                value={targetRepo.id}
                onChange={(e) => setConfigRepoId(e.target.value)}
                className="w-full h-10 px-3 text-xs font-mono rounded-2xl bg-[#070B18] border border-white/15 text-paper-100 focus:outline-none focus:border-[#2563EB]"
              >
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.fullName} {repo.webhook?.enabled ? '● Ativo' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {webhookFeedback && (
            <div
              className="rounded-2xl px-4 py-3 text-xs font-medium flex items-center gap-2 border"
              style={{
                background:
                  webhookFeedback.kind === 'success'
                    ? 'rgba(5, 150, 105, 0.08)'
                    : 'rgba(220, 38, 38, 0.1)',
                borderColor:
                  webhookFeedback.kind === 'success'
                    ? 'rgba(5, 150, 105, 0.4)'
                    : 'rgba(220, 38, 38, 0.45)',
                color: webhookFeedback.kind === 'success' ? 'var(--color-ok-400)' : '#DC2626',
              }}
            >
              {webhookFeedback.kind === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{webhookFeedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveWebhook} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Provider Selector */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="text-xs font-semibold text-paper-300">Provedor de Mensageria</div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setProvider('slack')}
                  className="p-3.5 rounded-2xl border text-left transition-all"
                  style={{
                    borderColor:
                      provider === 'slack' ? '#047857' : 'rgba(148, 163, 184, 0.18)',
                    background:
                      provider === 'slack'
                        ? 'rgba(5, 150, 105, 0.12)'
                        : 'var(--color-ink-850)',
                    boxShadow:
                      provider === 'slack'
                        ? '0 0 20px -8px rgba(5, 150, 105, 0.7)'
                        : 'none',
                  }}
                >
                  <div className="font-display text-sm font-bold text-paper-100">Slack</div>
                  <div className="text-[11px] font-mono text-paper-400 mt-0.5">
                    hooks.slack.com
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('discord')}
                  className="p-3.5 rounded-2xl border text-left transition-all"
                  style={{
                    borderColor:
                      provider === 'discord' ? '#7C3AED' : 'rgba(148, 163, 184, 0.18)',
                    background:
                      provider === 'discord'
                        ? 'rgba(124, 58, 237, 0.16)'
                        : 'var(--color-ink-850)',
                    boxShadow:
                      provider === 'discord'
                        ? '0 0 20px -8px rgba(124, 58, 237, 0.8)'
                        : 'none',
                  }}
                >
                  <div className="font-display text-sm font-bold text-paper-100">Discord</div>
                  <div className="text-[11px] font-mono text-paper-400 mt-0.5">
                    discord.com/api
                  </div>
                </button>
              </div>

              <div className="rounded-2xl p-3.5 bg-[#070B18] border border-white/10 text-[11px] text-paper-400 space-y-1">
                <div className="flex items-center gap-1.5 text-paper-200 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Proteção Anti-SSRF (§24)</span>
                </div>
                <p>
                  Apenas URLs HTTPS oficiais de <span className="font-mono text-paper-200">hooks.slack.com/services/</span> ou <span className="font-mono text-paper-200">discord.com/api/webhooks/</span> são aceitas no proxy do servidor.
                </p>
              </div>
            </div>

            {/* URL, Channel & Triggers */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="webhook-url-input"
                    className="block text-xs font-semibold text-paper-300 mb-1.5"
                  >
                    URL do Webhook ({provider === 'slack' ? 'Slack' : 'Discord'})
                  </label>
                  <input
                    id="webhook-url-input"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder={
                      provider === 'slack'
                        ? 'https://hooks.slack.com/services/T000/B000/XXXX'
                        : 'https://discord.com/api/webhooks/1234567890/token'
                    }
                    className="w-full h-10 px-3.5 text-xs font-mono rounded-2xl bg-[#070B18] border border-white/15 text-paper-100 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="webhook-channel-input"
                    className="block text-xs font-semibold text-paper-300 mb-1.5"
                  >
                    Canal (opcional)
                  </label>
                  <input
                    id="webhook-channel-input"
                    type="text"
                    value={channelLabel}
                    onChange={(e) => setChannelLabel(e.target.value)}
                    placeholder="#governanca-360"
                    className="w-full h-10 px-3.5 text-xs font-mono rounded-2xl bg-[#070B18] border border-white/15 text-paper-100 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#070B18] border border-white/10 cursor-pointer hover:border-[#2563EB]/50">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-paper-100">Integração ativa</div>
                    <div className="text-[11px] text-paper-400">
                      Habilita disparos automáticos
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#070B18] border border-white/10 cursor-pointer hover:border-[#047857]/50">
                  <input
                    type="checkbox"
                    checked={notifyOnHandoff}
                    onChange={(e) => setNotifyOnHandoff(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-paper-100">Novos Handoffs</div>
                    <div className="text-[11px] text-paper-400">
                      Notifica criação de handoff (§18)
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#070B18] border border-white/10 cursor-pointer hover:border-[#DC2626]/50">
                  <input
                    type="checkbox"
                    checked={notifyOnAuditFailure}
                    onChange={(e) => setNotifyOnAuditFailure(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-paper-100">Falhas de Auditoria</div>
                    <div className="text-[11px] text-paper-400">
                      Parecer REPROVADO/BLOQUEADO ou gate FALHOU
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] font-mono text-paper-400">
                  {targetRepo.webhook?.lastTestedAt ? (
                    <span>
                      Último teste:{' '}
                      <strong
                        className={
                          targetRepo.webhook.lastTestStatus === 'ok'
                            ? 'text-[#047857]'
                            : 'text-[#DB2777]'
                        }
                      >
                        {targetRepo.webhook.lastTestStatus === 'ok' ? 'ENTREGUE' : 'FALHA'}
                      </strong>{' '}
                      ({new Date(targetRepo.webhook.lastTestedAt).toLocaleString('pt-BR')})
                    </span>
                  ) : (
                    <span>Nenhum teste de disparo executado ainda.</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {targetRepo.webhook && (
                    <button
                      type="button"
                      onClick={handleDisconnectWebhook}
                      className="btn !rounded-2xl !px-3.5 !py-2 text-xs font-semibold border border-[#DC2626]/45 text-[#DC2626] hover:bg-[#DC2626]/10"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Remover Webhook</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook}
                    className="btn !rounded-2xl !px-3.5 !py-2 text-xs font-semibold border border-[#2563EB]/50 text-[#2563EB] hover:bg-[#2563EB]/10"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testingWebhook ? 'Enviando teste...' : 'Testar Envio'}</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary !rounded-2xl !px-4 !py-2 text-xs font-bold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Webhook</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}

      {activeRepo && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel !rounded-3xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Scripts Detectados em package.json
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Utilizados pelo Gate Runner (§29) para não mascarar scripts ausentes.
            </p>
            {Object.keys(activeRepo.packageScripts).length === 0 ? (
              <div className="text-sm text-slate-500 py-4 border-t border-slate-100">
                Nenhum script encontrado em package.json deste repositório.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {Object.entries(activeRepo.packageScripts).map(([key, cmd]) => (
                  <div key={key} className="py-2 flex items-center justify-between gap-4 text-xs">
                    <span className="font-mono font-medium text-slate-800">{key}</span>
                    <span className="font-mono text-slate-500 truncate">{cmd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel !rounded-3xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Árvore Mapeada e Propriedade Automática (§15)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Amostra de arquivos inspecionados com resolução imediata de proprietário.
            </p>
            {activeRepo.samplePaths.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 border-t border-slate-100">
                Nenhum caminho mapeado neste repositório.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                {activeRepo.samplePaths.slice(0, 30).map((filePath) => {
                  const resolved = resolveFileOwnership(filePath);
                  return (
                    <div
                      key={filePath}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-mono text-slate-800 truncate">{filePath}</span>
                      <span className="text-slate-500 whitespace-nowrap shrink-0">
                        {resolved.ownerAgentIds.length > 0
                          ? `Agente ${resolved.ownerAgentIds.join(' / ')}`
                          : resolved.ruleType === 'decisao_humana'
                            ? 'Humano'
                            : 'Matriz'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
