# Etapa 0 — Reconciliação PRs × Achados (executada 2026-11-19)

**Base:** `origin/main @ db1d23170` (pós-merge #421) | **Método:** verificação direta de código em `origin/main` + mapa de PRs abertos/mesclados (#381–#423).
**Regra:** "coberto" = correção presente em main; "parcial" = mitigação sem fechar a causa raiz; "aberto" = código vulnerável/débil ainda em main; "PR pendente" = correção existe em PR aberto não mergeado.

## P0

| ID | Veredito | Evidência |
|---|---|---|
| DEBT-0001 deploy sem migrate/healthcheck | **ABERTO** | `deploy-ec2.sh` em main ainda é scp+`docker restart` cego (linhas 24–45). Nenhum PR cobre. |
| DEBT-0002 backup/restore stubs | **PARCIAL** | `scripts/db/backup-encrypted.sh` agora faz pg_dump+AES-256 real com `--verify-crypto`; mas `restore-test.sh` continua stub que só imprime sucesso; `dr-simulation.sh`/`rollback-drill.sh` não auditados como corrigidos. Falta restore real testado. |
| DEBT-0003 workers outbound sem consumidor | **ABERTO** | `src/bootstrap/workers.ts` registra `createBitrixOutboundWorker`/`createExternalCrmOutboundWorker` só em modo embedded; `worker.ts`/`worker-*.ts` dedicados não referenciam nenhum outbound. Filas ficam sem consumidor na topologia worker. |
| DEBT-0004 mobile sem DNS | **DEPENDE DE D-02** | #392 (docs mobile) mergeado; #398 (permissões iOS) aberto. DNS/backend mobile é decisão de escopo, não código. |

## P1

| ID | Veredito | Evidência |
|---|---|---|
| DEBT-0005 SSRF residual | **ABERTO em main / PRs pendentes** | `/prospecting/enrich` ainda usa `webScraperService.isSafeUrl` (match de string, sem DNS pinning, sem IPv6 ULA/CGNAT/metadata, sem revalidação de redirect) e **sem requireRole**. `ssrfGuard.ts` existe (#381) mas não está ligado nessa rota. **PR #401 aberto** (guard+RBAC) e **#413 aberto** (residual IPv6) — merge resolve. |
| DEBT-0006 fallback BITRIX24_WEBHOOK_URL | **ABERTO** | `LeadUseCases.ts:575` e `integrations/bitrix/service/settings.ts:15` ainda caem no env global. Depende de D-01 (env em prod) para severidade real. |
| DEBT-0007 webhook 3CX segredo global | **PARCIAL** | Segredo continua global (`env.THREECX_WEBHOOK_SECRET`), mas tenant agora resolvido por scan de extensão com descarte de ambiguidade + replay guard + timestamp. Forja cross-tenant mitigada, não eliminada — correção arquitetural (segredo por conexão) documentada como gap, depende de D-01. |
| DEBT-0008 hasLeadReplied sem corte temporal | **ABERTO** | `cadence/infra/hasLeadReplied.ts` busca qualquer inbound histórico (WhatsApp/email/voice) sem `createdAt >= run.startedAt`. Resposta antiga ainda encerra cadência. #389 não tocou isso. |
| DEBT-0009 toque pending sem TTL | **ABERTO** | `decideCadenceAction` retorna `wait/locked` para attempt `pending` sem sweeper/expiração em lugar nenhum de `src/features/cadence/`. |
| DEBT-0010 mensagens sem opt-out | **ABERTO** | Nenhum template/dispatcher de cadence/prospecção injeta "responda SAIR"/footer/List-Unsubscribe. |
| DEBT-0011 sendColdEmail sem persistência | **PARCIAL** | Opt-out unificado + legalBasis obrigatório + MX check entraram (#383/#389); mas envio ainda não grava `EmailMessage`/`Activity`, sem idempotência, sem bounce, legalBasis só vai para log. |
| DEBT-0012 loop ReAct fora do gateway | **PARCIAL** | `src/lib/agents/` ganhou `agentOrchestrator`/`tokenBudget` fail-closed (#388) e supervisor usa `getAiModel`/`logAiUsage`; quota/circuit-breaker por iteração do loop ReAct não confirmado. |
| DEBT-0013 consentimento IA = env allowlist | **DEPENDE DE D-05** | Sem mudança estrutural; é decisão de conformidade. |
| DEBT-0014 TokenQuota fail-open | **ABERTO** | `tokenQuota.service.ts:211` retorna 0 em falha de DB; `:454` fail-open sem tenantId em workers. |
| DEBT-0015 scriptAndPromptTool falso sucesso | **ABERTO** | `scriptAndPromptTool.ts:109-127` — fallback ainda fabrica prompt e `prisma.prompt.create` grava `approved: true` incondicional. |
| DEBT-0016 batchUpdateLeads não atômico | **RESOLVIDO** | #390 reescreveu `batchUpdateLeads`: falha por item vira `failedCount` sem gravação parcial de status; #395 disparou automação por lead alterado (adendo 24). |
| DEBT-0017 status fora do fluxo canônico | **ABERTO** | `aiPendingAction.service.ts:~260` — `start_cadence` faz `lead.updateMany({status:'Cadencia_Iniciada'})` direto, sem histórico/pipeline/closedAt. |
| DEBT-0018 Contact.companyId sem tenant | **ABERTO** | `PrismaContactRepository.create` repassa `companyId` sem validar `company.organizationId`; FK `onDelete: Cascade` sem guarda. |
| DEBT-0019 Company hard delete | **ABERTO** | `PrismaCompanyRepository.delete` → `prisma.company.delete` direto; `deletedAt` do schema segue não usado. |
| DEBT-0020 import Bitrix não atômico | **PARCIAL** | `service/leads.ts` melhorou dedup/P2002, mas import multi-entidade (Company→Contact→Lead) continua sequência de creates sem `$transaction` — órfãos parciais possíveis. |
| DEBT-0021 retentionPurge dead code/RLS | **ABERTO** | `retentionPurge.service.ts` usa `prisma.*` cru sem `requestContext` e **não é referenciado por nenhum worker/rota** — retenção nunca executa. |
| DEBT-0022 voz sem retenção/consentimento | **DEPENDE DE D-03** | Cluster `voice/` dormente; `voice-hub` RLS test adicionada (#384). Se voz fora do escopo Day-1, rebaixa. |
| DEBT-0023 executeVoiceCommand falso sucesso | **ABERTO (dormente)** | `sip-webrtc-bridge.service.ts` segue no cluster excluído do tsconfig — risco só se reativado. |
| DEBT-0024 sem criação manual de lead | **ABERTO** | API `POST /leads` existe; nenhum `LeadForm`/UI de criação manual em `src/features/crm/`. |
| DEBT-0025 clusters mortos | **PARCIAL** | tsconfig agora exclui `voice-hub`, `cadence/dialer`, `prospecting/outbound`, `temporal-workers`, `crawlee`; `ai-voice/`, `voice/`, `proposals/`, `design-lab/` seguem incluídos — decisão de remover/reintegrar pendente (D-06). |
| DEBT-0026 SonarQube cobertura | **PARCIAL** | `verify:integrations`/`verify:ai` agora rodam em `onda-2.5-validation.yml`; cobertura Sonar segue restrita a escopo limitado — issue #200 provavelmente ainda insatisfatível. |

## Síntese para decisão de merge

- **Resolvidos em main:** DEBT-0016 (e parcialmente 0002, 0007, 0011, 0012, 0020, 0025, 0026).
- **Aguardando merge de PR aberto:** DEBT-0005 → **#401 + #413** (prioridade máxima — é o único P1 "bloqueador" com fix pronto).
- **Precisam de código novo (viram handoffs F1+):** 0001, 0003, 0008, 0009, 0010, 0014, 0015, 0017, 0018, 0019, 0021, 0024.
- **Depende de decisão humana:** 0004 (D-02), 0006 (D-01), 0007 residual (D-01), 0013 (D-05), 0022/0023 (D-03), 0025 (D-06).

## Ordem de merge revisada (pós-reconciliação)

1. **#401 + #413** — fecha DEBT-0005 (SSRF), único bloqueador com fix pronto.
2. **#415** — fixes P0 de segurança extraídos do #310.
3. **#396–#399, #406, #414, #422, #423** — saneamento AUD-1/ONDAS pendente de revisão 24.
4. Conflitantes antigos (#361, #366, #368, #372, #378, #379) — avaliar um a um; #378 (findUnique soft-delete) parece relevante para DEBT-0019 adjacente.
5. Docs (#386, #393, #410, #411, #414, #420) — sem impacto em bloqueio.
