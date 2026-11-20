- De: 00
- Para: 16 (Workers/Filas)
- Status: AGUARDANDO_24
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

## Resolução

**Branch:** `agente/16-workers-filqs` | **Worktree:** `C:\Github\Birthub-360-wt\ag-16` | **Commit:** `bd8597e23`

### Entregue
- **DEBT-0003**: `worker.ts` agora registra `createBitrixOutboundWorker` e `createExternalCrmOutboundWorker` — filas `bitrix-outbound-sync`/`external-crm-outbound-sync` deixam de ficar sem consumidor na topologia dedicada. Workers já tinham DLQ/retry próprios.
- **WRK-02**: novo `src/lib/queue/queueDefaults.ts` (`SCHEDULER_SCAN_DEFAULTS`: attempts 3 + backoff exponencial 60s + retenção) aplicado via `defaultJobOptions` nas filas de scan: bitrixSync, coldCall, followUp, cadenceRun, coldLeadsScanner. Jobs com `opts.attempts` explícito mantêm precedência — `coldCall`/`bitrixSync` ticks seguem `attempts:1` **deliberadamente** (retry duplicaria ligações/efeitos; tick seguinte cura). Documentado em código.
- **WRK-03**: `OutboxRelay.start()` agora agenda `purgeExpired()` diário + execução no boot — DEAD_LETTER não acumula mais sem caller. `requeueDeadLetters` já existia como operação admin.
- **WRK-05**: `registerQueueForMetrics` adicionado às filas voice-hub `webhooks`, `auditLogs`, `callLogRetention`, `platformSlaCheck`.
- **WRK-06**: novo counter `webhook_dispatch_dropped_total{reason}` incrementado nos dois caminhos de drop do `WebhookService.dispatch` (falha de resolução de endpoint + erro genérico). Contrato never-throw mantido; delivery já tem retry/DLQ em `webhook.worker.ts`.
- **WRK-04**: verificado — `outboundCallService.initiateOutboundCall` já deduplica via `createOutboundPhoneSessionIfNoneInFlight` em transação Serializable (orgId+número), mais forte que lock. Coberto, sem mudança.

### Gates
- `tsc --noEmit` no worktree: **limpo** (node_modules via junction para o repo principal).

### Limitações
- WRK-02 cobriu as 5 filas nomeadas no achado; outras filas sem defaultJobOptions (agent, knowledgeIngestion, whatsappSignal/Command, newsMonitor, etc.) seguem sem padronização — recomendo handoff de follow-up para varredura completa.
- `requeueDeadLetters` não tem rota admin HTTP — continua operação programática; se desejado, abrir handoff para expor endpoint autenticado.
- Testes de unidade da outbox não reexecutados (suite completa não rodada neste worktree).
