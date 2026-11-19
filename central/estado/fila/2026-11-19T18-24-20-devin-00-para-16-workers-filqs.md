# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\Github\Birthub-360
Worktree de trabalho: C:\Github\Birthub-360-wt\ag-16 | Branch: agente/16-workers-filqs

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
C:\Github\Central-de-Auditoria-e-Handoffs\central\ondas\release-readiness-2026-11-18\handoffs\00-para-16-workers-filqs.md

## Conteúdo do handoff
- De: 00
- Para: 16 (Workers/Filas)
- Status: PENDENTE
- Prioridade: P0-condicional / P1

## Achados (relatório: auditoria/voz-telefonia-workers.md)

### DEBT-0003 — Worker dedicado sem consumidores outbound — P0 se topologia dedicada
`worker.ts:14-203` não registra `createBitrixOutboundWorker`/`createExternalCrmOutboundWorker`; só existem em `workers.ts:192-193` (modo embedded). Filas `bitrix-outbound-sync`/`external-crm-outbound-sync` enfileiram sem consumidor → sync CRM para silenciosamente.
**Ação:** confirmar topologia de produção (env `ENABLE_QUEUES`/embedded). Se dedicado → registrar as 2 factories + parity test. Se embedded → reclassificar P3 e documentar.

### WRK-02 — Retry/backoff/DLQ inconsistente — P1
Queues sem defaultJobOptions; schedulers (coldCall, bitrixSync, followUp, cadenceRun, cold-leads) sem attempts/backoff → falha transitória perde ciclo. Padronizar por classe de fila + idempotencyKey p/ efeitos externos.

### WRK-03 — DLQ outbox sem requeue/purge agendado — P2
`outboxRelay.service.ts:132-153`: DEAD_LETTER acumula; retenção LGPD depende de chamada ausente. Agendar purgeExpired diário + requeue admin auditado.

### WRK-05/06 — Filas voice-hub fora de métricas; webhookService.dispatch engole falha — P2
webhooks/callLogRetention/platformSlaCheck/auditLogs sem registerQueueForMetrics; dispatch catch+log sem DLQ.

### WRK-04 (co 12) — Chamadas voz sem lock/idempotência — P1
Lock por (orgId, leadId|phoneE164) ou fila c/ jobId deduplicado.


## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
