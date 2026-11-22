# 11 — MATRIZ DE RISCOS

| ID | Descrição | Evidência | Prob. | Impacto | Severidade | Responsável | Mitigação | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | **Perda do trabalho não commitado de 21/11** (~870 linhas: Gemini, chat, UI) | `git status`: 15 modified + 3 .ts novos sem commit desde 21/11 13:02 | Média | Alto | **ALTA** | Humano decide + executor designado | CENTRAL-0001 imediato; commit em branch dedicada | ABERTO |
| R-02 | Re-despacho duplicado de handoffs cujas execuções podem ter commits nos worktrees `ag-*` | Locks expirados; worktrees "ACTIVE" sem verificação | Média | Alto | **ALTA** | Coordenador | CENTRAL-0021/0023 antes de despachar | ABERTO |
| R-03 | Divergência branches `agente/*` × main (conteúdo parcialmente mergeado por outros PRs) | Checklist §9 lista 7 branches NOT-MERGED | Alta | Médio | **MÉDIA** | Agente 00 | Diff-a-diff (CENTRAL-0021); Trava de Mutação residual | ABERTO |
| R-04 | Locks/estado vivo divergente entre sessões paralelas | `central/estado/` parcialmente tracked; 4 locks untracked | Média | Médio | **MÉDIA** | Coordenador | CENTRAL-0003 saneamento + CENTRAL-0005 política | ABERTO |
| R-05 | Waivers Trivy vencem 30/11 → bloqueio de release | ARQ-13; handoff mestre §7 | Alta (se release ≤30/11) | Alto | **ALTA** | Humano + agente 08 | CENTRAL-0020 urgente | ABERTO |
| R-06 | RLS não aplicada — exposição de dados entre tenants | DEBT-0057/0058/DB-08 P0 | — | Alto | **ALTA** | Agente 01 | CENTRAL-0026a prioritário | ABERTO |
| R-07 | Restore de backup nunca testado de verdade | `BACKUP-RESTORE-DRILL-RESULT.json` inexistente | — | Alto | **ALTA** | Humano (host) | CENTRAL-0029 após D-01 | ABERTO (bloqueado) |
| R-08 | P1s de segurança do produto abertos (SSRF, segredo 3CX global, ReAct fora do gateway, consentimento env-only, PII voz) | Checklist HTML; D-02/03/05 promoveram a bloqueadores | — | Alto | **ALTA** | Donos 05/12/07/13/15 | CENTRAL-0025/0027 | ABERTO |
| R-09 | PRs documentais #9–12 sobrepostos → merges conflitantes ou conteúdo duplicado | `gh pr list`: 4 OPEN mesma família | Alta | Baixo | **BAIXA** | Humano | CENTRAL-0002: merge ordenado ou fechar duplicados | ABERTO |
| R-10 | Sessões paralelas commitando direto na main sem handoff | Histórico 19–21/11 (3 sessões simultâneas) | Média | Médio | **MÉDIA** | Orquestrador Humano | Regra: handoff de encerramento obrigatório; staging explícito | ABERTO (processual) |
| R-11 | Adapter Gemini novo sem revisão — pode executar handoffs com chave do usuário | Código não commitado | Baixa | Médio | **BAIXA** | Revisor | Só usar após CENTRAL-0001 + revisão | ABERTO |
| R-12 | Senha admin fallback `birthhub360` se app for exposto | auth.ts; handoff plataforma §7 | Baixa | Médio | **BAIXA** | Humano | CENTRAL-0009 trocar senha | ABERTO |
| R-13 | Handoff 15: execução fantasma pode ter alterado código sem registro | exit 0 sem Status | Baixa | Médio | **BAIXA** | Coordenador | CENTRAL-0024 investigar diff do worktree/branch | ABERTO |
| R-14 | Índices/estado documentais desatualizados induzem erro de planejamento | INDEX "aguardando Etapa 0"; central-state contraditório | Alta | Baixo | **BAIXA** | Coordenador | CENTRAL-0004 | ABERTO |
| R-15 | Perda de conhecimento: sessão 21/11 sem handoff | Nenhum HANDOFF-ENCERRAMENTO cobre 21/11 tarde | — | Médio | **MÉDIA** | Esta consolidação | Documentos 02/04 registram a lacuna | MITIGADO (registrado) |

**Riscos resolvidos (com evidência):** divergência main local×origin (0/0); commits não publicados (nenhum); stashes (nenhum); testes quebrados pelo trabalho novo (89/89 verdes); build quebrado (OK).
