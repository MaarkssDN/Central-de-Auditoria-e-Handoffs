# BACKLOG MESTRE DA CENTRAL DE AUDITORIA E HANDOFF
**Itens de Evolução, Estabilização e Governança da Plataforma**
*Data de Criação: 2026-11-21 | Status: PRIORIZADO*

---

## 1. CRITÉRIOS DE PRIORIZAÇÃO

- **P0 — CRÍTICA:** Falhas ou riscos que comprometem integridade de dados, concorrência, locks órfãos, preservação de código ou corrupção de estado.
- **P1 — ALTA:** Funcionalidades essenciais da Central, reconciliação de PRs e bloqueios que impedem os ciclos de auditoria e coordenação.
- **P2 — MÉDIA:** Melhorias operacionais, eliminação de código morto, unificação de logs e refinamento de experiência de usuário.
- **P3 — BAIXA:** Otimizações visuais avançadas, documentação suplementar e automações de conveniência.

---

## 2. ITENS DO BACKLOG MESTRE

### [P0-01] Preservação e Integração do Trabalho Local Não Commitado no Repo Canônico
- **ID:** `BCK-P0-01`
- **Módulo:** Plataforma / Backend & Frontend
- **Descrição Técnica:** O diretório `C:\Github\Central-de-Auditoria-e-Handoffs` possui alterações uncommitted que implementam estatísticas SQLite (`getDbStats`), chat history (`saveChatMessage`), serviço Gemini AI (`server/geminiService.ts`), testes e integrações de UI. Este trabalho deve ser inspecionado, organizado e commitado de forma segura em branch dedicada sem sobrescrever histórico.
- **Prioridade:** **P0 — CRÍTICA**
- **Status:** **PENDENTE_AUTORIZACAO**
- **Responsável:** Coordenador Operacional / Engenheiro de Plataforma
- **Handoff de Origem:** `HND-PLAT-11` / Análise Forense de 2026-11-21
- **Arquivos Afetados:** `server.ts`, `server/db.ts`, `server/centralApi.ts`, `server/geminiService.ts`, `server/db.test.ts`, `server/geminiService.test.ts`, `src/components/AuditReviewView.tsx`, `src/components/FilesView.tsx`, `src/components/HandoffsCenterView.tsx`
- **Dependências:** Autorização explícita do Orquestrador Humano.
- **Critério de Aceite:** Alterações commitadas em branch limpa (`feat/platform-sqlite-gemini-stats`), suíte de 89 testes passando, `tsc --noEmit` limpo e build verde.
- **Testes Necessários:** `npm test`, `npm run lint`, `npm run build`.
- **Evidências Existentes:** Testes `db.test.ts` e `geminiService.test.ts` já passam com êxito no ambiente local (89/89).
- **Riscos:** Perda de trabalho em caso de `git checkout -f` ou `git reset` acidental.
- **Próximo Passo:** Solicitar autorização ao Humano para criar a branch e commitar as alterações locais.

---

### [P0-02] Expurgar e Reconciliar Locks e Filas Expiradas em `central/estado/`
- **ID:** `BCK-P0-02`
- **Módulo:** Motor de Execução / Locks
- **Descrição Técnica:** Os arquivos de lock em `central/estado/locks/` e os prompts em `central/estado/fila/` pertencentes ao lote de 19/11 expiraram há mais de 40 horas. O sistema precisa arquivar ou limpar estes locks residuais sem corromper o estado global em `central-state.json`.
- **Prioridade:** **P0 — CRÍTICA**
- **Status:** **PLANEJADO**
- **Responsável:** Coordenador Operacional
- **Handoff de Origem:** `HND-PLAT-01` / `HND-PLAT-02`
- **Arquivos Afetados:** `central/estado/locks/*.json`, `central/estado/fila/*.md`, `central/estado/central-state.json`
- **Dependências:** Conclusão da Onda 0 (preservação).
- **Critério de Aceite:** Nenhum lock com `expiresAt < now` ativo no diretório de locks; status de handoffs em `central-state.json` consistente.
- **Testes Necessários:** `server/phase1/locks.test.ts`.
- **Evidências Existentes:** Locks JSON inspecionados com data de expiração `2026-11-19T22:00:00Z`.
- **Riscos:** Liberação indevida de locks caso haja agentes externos ativos no mesmo segundo.
- **Próximo Passo:** Mover locks expirados para subpasta `central/estado/locks/archive/`.

---

### [P1-01] Homologação dos 4 PRs de Handoff em Aberto (#9, #10, #11, #12)
- **ID:** `BCK-P1-01`
- **Módulo:** Governança / Git
- **Descrição Técnica:** Os PRs #9, #10, #11 e #12 foram abertos por sessões anteriores do Devin e contêm documentação complementar de encerramento. Devem ser revisados pelo Humano e integrados à `main` para evitar dispersão de branches documentais.
- **Prioridade:** **P1 — ALTA**
- **Status:** **AGUARDANDO_DECISAO_HUMANA**
- **Responsável:** Orquestrador Humano
- **Handoff de Origem:** `HND-PLAT-09`, `HND-PLAT-10`, `HND-PLAT-11`
- **Arquivos Afetados:** `central/HANDOFF-ENCERRAMENTO-*.md`
- **Dependências:** Decisão humana sobre merge direto ou fechamento pós-consolidação mestre.
- **Critério de Aceite:** PRs aprovados e mergeados ou consolidados formalmente no índice mestre.
- **Testes Necessários:** `git status`, `gh pr list`.
- **Evidências Existentes:** PRs listados e verificados via `gh pr view`.
- **Riscos:** Conflitos superficiais em `central/HANDOFF-ENCERRAMENTO-20261120.md`.
- **Próximo Passo:** Apresentar recomendação ao Humano.

---

### [P1-02] Unificação dos Sistemas de Registro de Execução (`centralExecutions` vs `phase1/executions`)
- **ID:** `BCK-P1-02`
- **Módulo:** Observabilidade / Logs
- **Descrição Técnica:** Atualmente, a plataforma grava eventos simultaneamente em dois destinos: `server/centralExecutions.ts` (JSONL diário em `central/estado/executions/YYYY-MM-DD.jsonl`) e `server/phase1/executions.ts` (JSON isolado por id). É necessário estabelecer o JSONL como formato canônico oficial e adaptar `phase1/executions.ts` como ponte de compatibilidade.
- **Prioridade:** **P1 — ALTA**
- **Status:** **PLANEJADO**
- **Responsável:** Engenheiro de Plataforma
- **Handoff de Origem:** `HND-PLAT-08` / `HND-PLAT-04`
- **Arquivos Afetados:** `server/centralExecutions.ts`, `server/phase1/executions.ts`, `server/phase1/adapters.ts`
- **Dependências:** Estabilização da Onda 1.
- **Critério de Aceite:** Um único ponto de entrada para gravação de eventos de execução; zero discrepância de logs.
- **Testes Necessários:** `server/centralEvents.test.ts`, `server/phase1/phase1.test.ts`.
- **Evidências Existentes:** Ambos os módulos implementados com testes unitários individuais.
- **Riscos:** Quebra de contratos em endpoints que consom histórico específico.
- **Próximo Passo:** Criar wrapper unificado e atualizar adapters.

---

### [P1-03] Trava de Segurança no Endpoint de Abertura de PR (`POST /api/central/github/pr`)
- **ID:** `BCK-P1-03`
- **Módulo:** Integração GitHub / Governança
- **Descrição Técnica:** O endpoint `POST /api/central/github/pr` atualmente permite abrir PRs a partir de qualquer branch sem verificar se a entrega correspondente recebeu o parecer formal `APROVADO` do Agente 24. Deve ser inserido um gate obrigatório que rejeite abertura de PR caso não haja arquivo de revisão com veredito favorável.
- **Prioridade:** **P1 — ALTA**
- **Status:** **PLANEJADO**
- **Responsável:** Engenheiro de Plataforma
- **Handoff de Origem:** `HND-PLAT-04`
- **Arquivos Afetados:** `server/centralGithub.ts`, `server/centralApi.ts`
- **Dependências:** `server/phase1/stateMachine.ts`.
- **Critério de Aceite:** Requisição para `/api/central/github/pr` retorna HTTP 403 / 412 se o parecer 24 não for `APROVADO`.
- **Testes Necessários:** Novo teste em `server/centralGithub.test.ts`.
- **Evidências Existentes:** PR #423 criado diretamente no Birthub por sessão anterior.
- **Riscos:** Bloquear aberturas de PR manuais em casos de emergência (mitigado por flag `--force-bypass` para o Humano).
- **Próximo Passo:** Implementar middleware de validação do parecer 24 antes do disparo de `gh pr create`.

---

### [P2-01] Limpeza de Código Órfão e Padronização de Design (`LandingPage.tsx` e `film.css`)
- **ID:** `BCK-P2-01`
- **Módulo:** Frontend / UI
- **Descrição Técnica:** O componente `LandingPage.tsx` e o arquivo `src/film.css` foram desacoplados quando o usuário optou por login direto e dark mode padrão. Devem ser devidamente arquivados em pasta `src/legacy/` ou removidos para evitar confusão de manutenção.
- **Prioridade:** **P2 — MÉDIA**
- **Status:** **PLANEJADO**
- **Responsável:** Desenvolvedor Frontend
- **Handoff de Origem:** `HND-PLAT-07`
- **Arquivos Afetados:** `src/components/LandingPage.tsx`, `src/film.css`
- **Dependências:** Confirmação humana de que a landing page pública não será reutilizada.
- **Critério de Aceite:** `src/` limpo sem imports mortos e `npm run build` mantendo integridade.
- **Testes Necessários:** `npm run build`.
- **Evidências Existentes:** `LandingPage.tsx` existe no disco mas não é importado em `src/App.tsx`.
- **Riscos:** Nenhum. Código inativo.
- **Próximo Passo:** Mover para diretório legacy ou excluir após aval humano.

---

### [P2-02] Suporte a Destinatário Canônico (`toAgentId`) no Workspace de Bots
- **ID:** `BCK-P2-02`
- **Módulo:** Workspace de Bots / Agentes
- **Descrição Técnica:** Adicionar o campo `toAgentId?: string` à tipagem `AgentBotMessage` e persistir o destinatário nas mensagens de turnos para que o Quadro exiba setas de direcionamento reais (`@agente-00 -> @agente-01`) em vez de inferência de turno.
- **Prioridade:** **P2 — MÉDIA**
- **Status:** **PLANEJADO**
- **Responsável:** Desenvolvedor Fullstack
- **Handoff de Origem:** `HND-PLAT-06`
- **Arquivos Afetados:** `src/types/governance.ts`, `server/agentRuntime.ts`, `src/components/AgentBotsWorkspace.tsx`, `server/db.ts`
- **Dependências:** Extensão da tabela SQLite `chat_messages`.
- **Critério de Aceite:** Mensagens persistem e renderizam o agente de origem e destino com fidelidade.
- **Testes Necessários:** `server/db.test.ts`.
- **Evidências Existentes:** UI de Board exibe traces com inferência de turno.
- **Riscos:** Migração leve na tabela `chat_messages`.
- **Próximo Passo:** Adicionar coluna `to_agent_id` na migração do SQLite.

---

### [P3-01] Sanitização Automática de Credenciais e Fortalecimento de Senha
- **ID:** `BCK-P3-01`
- **Módulo:** Segurança / Autenticação
- **Descrição Técnica:** Impedir que o servidor inicie com a senha fallback `birthhub360` em ambientes que não sejam estritamente localhost ou exigir que o primeiro login force a troca de senha se a variável `CENTRAL_ADMIN_PASSWORD` não estiver declarada.
- **Prioridade:** **P3 — BAIXA**
- **Status:** **PLANEJADO**
- **Responsável:** Engenheiro de Segurança / Plataforma
- **Handoff de Origem:** `HND-PLAT-05` / `HND-PLAT-07`
- **Arquivos Afetados:** `server/auth.ts`, `.env.example`
- **Dependências:** Nenhuma.
- **Critério de Aceite:** Alerta ostensivo emitido no boot e bloqueio de binding em IPs externos com senha padrão.
- **Testes Necessários:** Teste unitário de inicialização em `server/auth.test.ts`.
- **Evidências Existentes:** Fallback ativo em `server/auth.ts`.
- **Riscos:** Usuário esquecer nova senha (suporte a script local `reset-password.js`).
- **Próximo Passo:** Implementar aviso no boot e trava de host externo.
