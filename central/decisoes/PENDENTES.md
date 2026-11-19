# Decisões pendentes — respostas humanas obrigatórias

> O coordenador NÃO deve improvisar estas respostas. Cada item bloqueia handoffs específicos (listados).

## D-01 — Envs de produção EC2
Verificar no host de produção: `BITRIX24_WEBHOOK_URL`, `THREECX_WEBHOOK_SECRET`, `EXPOSE_METRICS`, `ENABLE_QUEUES`/topologia de workers, `CREDENTIALS_ENCRYPTION_KEY`, `PII_BLIND_INDEX_KEY`, `PLATFORM_OPERATOR_TOKEN`.
**Bloqueia:** severidade real de DEBT-0003, 0006, 0007; INF-04.
**Resposta:**

## D-02 — Escopo Day-1: mobile/Capacitor
O app Android aponta para backend sem DNS. Mobile entra no lançamento?
**Bloqueia:** DEBT-0004, INF-05.
**Resposta:** SIM — Capacitor/mobile entra no escopo Day-1 (2026-11-19). DEBT-0004/INF-05 promovidos a bloqueadores reais.

## D-03 — Escopo Day-1: voz/telefonia e enxame IA autônomo
Módulos gated (503) permanecem fora? IA externa/enxame entra?
**Bloqueia:** DEBT-0012–0015 (Trilha 3), DEBT-0022/0023 (parcial), política de módulos gated.
**Resposta:** SIM — voz/telefonia e enxame de IA autônomo entram no escopo do release (2026-11-19).

## D-04 — Janelas oficiais de retenção (LGPD)
Definir dias para: AuditLog, AILog, BitrixSyncLog, ExternalCrmSyncLog, AgentMemory, WhatsAppMessage, ConversationSignal, TimelineEvent, EnrichmentLog.
**Bloqueia:** DEBT-0021 (retenção nunca ligar sem isso).
**Resposta:**

## D-05 — Consentimento IA (DEBT-0013)
Env allowlist (`AI_PII_EXTERNAL_CONSENT_ORGANIZATIONS`) basta temporariamente (rebaixa p/ P2) ou exige consentimento persistido por titular desde já?
**Resposta:**

## D-06 — Veredito por módulo gated
Registro formal: voz/proposals/design-lab/outbound/temporal-workers — remover, arquivar ou reintegrar?
**Bloqueia:** DEBT-0025, ARQ-01/02/03, VOZ-05.
**Resposta:** TODOS LIBERADOS — ai-voice, voice, proposals, design-lab reintegrados ao escopo (2026-11-19). DEBT-0025 vira trabalho de reintegração, não de remoção.

## D-07 — `main` local vs origin e PRs conflitantes
Main local estava 8 commits à frente de origin/main; repo mudou para branch `agente/00-correcao-p0-auditoria` durante a auditoria (outra sessão ativa?). Confirmar estado git e destino dos merges.
**Bloqueia:** Etapa 0 / ordem de integração.
**Resposta:** EM ANDAMENTO — Etapa 0 executada (`auditoria/etapa0-reconciliacao-prs.md`). Stash@{0} revisado: salvage parcial proposto (AGENTS.md 02A–02D + manifest + LITELLM_MASTER_KEY); docker-compose.services.yml e alertmanager→blackhole descartados. Aguardando confirmação para aplicar.
