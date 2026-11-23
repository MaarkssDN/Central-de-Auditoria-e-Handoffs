# 13 — PLANO DE TESTES E HOMOLOGAÇÃO

**Escopo desta fase:** cenários preparados + evidências já existentes verificadas. Nenhum teste destrutivo ou de runtime com efeitos foi executado.

## A. Evidências já existentes (verificadas em 22/11)

| Verificação | Resultado | Evidência |
|---|---|---|
| Typecheck plataforma | ✅ limpo | `npx tsc --noEmit` exit 0 |
| Testes unitários plataforma | ✅ 89/89 | `npm test` (node --test, ~2.9s) |
| Build produção | ✅ OK | `npm run build` 2.58s (warning chunk >500kB) |
| Auditoria item-a-item do produto | ✅ ~60 itens com evidência arquivo:linha | `CHECKLIST-HANDOFFS-RELEASE-READINESS.html` |
| Revisão 24 da auditoria | ✅ parecer emitido | `auditoria/24-revisao-...md` |
| Smoke API (sessões anteriores) | ✅ registrado | FASE1/FASE3 handoffs (locks, 409, SSE, PR #423) |

## B. Cenários a executar (por prioridade)

### Plataforma (Trilha P)

| ID | Cenário | Objetivo | Pré-condições | Procedimento | Esperado | Prioridade |
|---|---|---|---|---|---|---|
| TP-01 | Commit + boot do trabalho Gemini | Validar CENTRAL-0001 integrado | HD-01 aprovado | `npm run dev`, login, chamar `/api/gemini/audit-file` com GEMINI_API_KEY | Resposta JSON; mensagem gravada em chat_messages | P0 |
| TP-02 | Persistência chat | Round-trip save/get/clear | TP-01 | POST→GET→DELETE `/api/central/chat/messages` | Mensagens persistem e limpam | P1 |
| TP-03 | Adapter gemini em dispatch | `POST /dispatch/execute` provider=gemini-api | TP-01 | Dispatch de handoff de teste em worktree descartável | Execution SUCCEEDED com output | P1 |
| TP-04 | Concorrência/locks | Dois claims no mesmo handoff | Estado limpo | `POST /locks/claim` duplo | Segundo retorna 409/owner | P1 |
| TP-05 | Recuperação de lock expirado | Lock stale é retomável | Lock com expiresAt passado | Novo claim | `stolen:true` | P2 |
| TP-06 | SSE eventos | Painel ao vivo recebe eventos | Servidor rodando | Dispatch → assinar `/api/central/events` | Eventos `exec_*` chegam | P2 |
| TP-07 | Relatório executivo | `GET /api/central/report?wave=...` | — | Chamada autenticada | HTML standalone gerado | P2 |
| TP-08 | Graceful shutdown | SIGTERM drena fila | Fila com job | Enviar sinal | Exit limpo sem perda | P3 |

### Produto Birthub-360 (Trilha B)

| ID | Cenário | Objetivo | Prioridade |
|---|---|---|---|
| TB-01 | Gates por handoff (tsc/lint/testes domínio) | Evidência real por entrega | P0 |
| TB-02 | Revisão 24 de cada entrega | Parecer APROVADO/REPROVADO | P0 |
| TB-03 | Fluxo E2E: handoff→execução→status→revisão→CONCLUÍDO | Pipeline ponta a ponta | P1 |
| TB-04 | RLS: tenant A não lê dados do tenant B | DEBT-0057/0058/DB-08 | P0 |
| TB-05 | Restore de backup real no host | DR real | P1 (após D-01) |
| TB-06 | SSRF: URLs internas/metadata/IPv6 rejeitadas | DEBT-0005 | P0 |
| TB-07 | Consentimento IA: titular sem consent → PII não sai p/ externo | DEBT-0013 | P0 |
| TB-08 | Idempotência prospecção: retry não duplica disparo | DEBT-0011/0044 | P1 |
| TB-09 | Opt-out: mensagem outbound instrui SAIR; List-Unsubscribe | DEBT-0010 | P1 |
| TB-10 | Mobile: App Links verificam (assetlinks+DNS) | DEBT-0004/INF-05 | P1 |
| TB-11 | Concorrência workers/filas DLQ | DEBT-0003/WRK-* | P1 |
| TB-12 | Build Android/Capacitor Day-1 | D-02 | P1 |
| TB-13 | Performance/carga básica do produto | Baseline | P2 |
| TB-14 | Acessibilidade telas principais | WCAG básico | P2 |

## C. Regras

- Nenhum cenário é "aprovado" sem execução real e evidência registrada.
- Testes destrutivos (drop stash, restore em prod, merge) exigem autorização humana explícita.
- Cada executor registra comando + exit code na `## Resolução` do handoff.
