# PLANO DETALHADO DE ONDAS DA CENTRAL DE AUDITORIA
**Planejamento Operacional de Evolução e Estabilização**
*Versão: 2.0 | Data: 2026-11-21 | Status: HOMOLOGADO*

---

## ONDA 0 — PRESERVAÇÃO E RECUPERAÇÃO OPERACIONAL

### 1. Identificação
- **ID:** `WAVE-0`
- **Nome:** Preservação, Higiene de Locks e Reconciliação de Sessões
- **Objetivo:** Garantir a salvaguarda de todo o trabalho não commitado no repositório principal da Central, higienizar locks e filas expiradas e reconciliar branches e PRs pendentes sem perda de dados.
- **Prioridade:** **P0 — CRÍTICA / IMEDIATA**

### 2. Escopo
- **Módulos:** Governança Git, Backend Persistence, Locks & Fila.
- **Funcionalidades:** Commit seguro de alterações locais em branch dedicada (`feat/platform-sqlite-gemini-stats`), arquivamento de locks expirados (`central/estado/locks/archive/`), reconciliação dos PRs #9, #10, #11 e #12.
- **Arquivos:** `server.ts`, `server/db.ts`, `server/centralApi.ts`, `server/geminiService.ts`, `central/estado/locks/*.json`, `central/estado/fila/*.md`.
- **Handoffs de Origem:** `HND-PLAT-01`, `HND-PLAT-02`, `HND-PLAT-07`, `HND-PLAT-11`.

### 3. Responsáveis
- **Agente Executor:** Coordenador Operacional da Central (`agente-00`).
- **Agente de Apoio:** Engenheiro de Plataforma (`subagent_general`).
- **Validador:** Orquestrador Humano e Agente 24 (`subagent_explore`).

### 4. Dependências
- **Aprovações Humanas:** Autorização para commit e definição do destino dos PRs #9–#12.
- **Infraestrutura:** Acesso ao git local em `C:\Github\Central-de-Auditoria-e-Handoffs`.

### 5. Execução
- **Ordem:** 
  1. Criação de branch para o trabalho local e commit das melhorias de SQLite e Gemini.
  2. Mover arquivos de lock e fila expirados para pasta de histórico (`central/estado/locks/archive/`).
  3. Atualizar `central-state.json` com checkpoint limpo.
- **Paralelismo:** Serial (operações sobre o estado compartilhado da Central).
- **Critério de Início:** Aprovação formal do plano mestre pelo Humano.
- **Critério de Conclusão:** Working tree limpa, commits salvos, zero locks fantasmas.

### 6. Validação
- **Testes:** `git status` limpo, `npm test` mantendo 89/89 verdes.
- **Evidências:** SHAs de commit e listagem de diretório de locks vazio.

### 7. Checklist da Onda 0
- [ ] Alterações locais do repositório principal inspecionadas e commitadas.
- [ ] Branch de preservação enviada ou registrada localmente.
- [ ] PRs #9, #10, #11 e #12 revisados com o Humano.
- [ ] Locks expirados de 19/11 movidos para arquivamento histórico.
- [ ] Checkpoint em `central/estado/central-state.json` atualizado.
- [ ] Testes automatizados executados e 100% aprovados.

---

## ONDA 1 — HANDOFFS E FONTE DE VERDADE

### 1. Identificação
- **ID:** `WAVE-1`
- **Nome:** Padronização de Handoffs e Consolidação de Logs de Execução
- **Objetivo:** Unificar a estrutura de metadados dos handoffs, consolidar os dois sistemas concorrentes de log de execução em um único padrão JSONL canônico e garantir integridade referencial.
- **Prioridade:** **P1 — ALTA**

### 2. Escopo
- **Módulos:** Handoff Engine, Observabilidade (Execution Logs).
- **Funcionalidades:** Unificação de `server/centralExecutions.ts` e `server/phase1/executions.ts`, padronização do schema de handoffs (`TEMPLATE-HANDOFF.md`), integridade referencial entre `central-state.json` e arquivos markdown.
- **Arquivos:** `server/centralExecutions.ts`, `server/phase1/executions.ts`, `server/phase1/adapters.ts`, `central/TEMPLATE-HANDOFF.md`.
- **Handoffs de Origem:** `HND-PLAT-04`, `HND-PLAT-08`.

### 3. Responsáveis
- **Agente Executor:** Engenheiro de Plataforma (`subagent_general`).
- **Agente de Apoio:** Especialista em Governança.
- **Validador:** Agente 24.

### 4. Dependências
- **Onda Anterior:** Conclusão da Onda 0.

### 5. Execução
- **Ordem:** Adaptar `phase1/executions.ts` para escrever no barramento e no log diário JSONL oficial; atualizar testes unitários.
- **Paralelismo:** Pode rodar em paralelo com tarefas de documentação da Onda 2.
- **Critérios de Conclusão:** Todas as transições de handoff gravando exclusivamente no log canônico.

### 6. Validação
- **Testes:** `npm test -- server/centralEvents.test.ts server/phase1/phase1.test.ts`.
- **Evidências:** Logs JSONL gerados em `central/estado/executions/` com integridade de schema.

### 7. Checklist da Onda 1
- [ ] Duplicidade de execution logs eliminada.
- [ ] Adaptadores da Fase 1 integrados ao barramento de eventos SSE.
- [ ] Transições de status testadas com persistência atômica.
- [ ] Metadados de handoffs alinhados com o template oficial.
- [ ] Revisão independente do Agente 24 favorável.

---

## ONDA 2 — AUDITORIA E VALIDAÇÃO INDEPENDENTE

### 1. Identificação
- **ID:** `WAVE-2`
- **Nome:** Validação Automática de Evidências e Governança do Parecer 24
- **Objetivo:** Fortalecer o processo de auditoria técnica introduzindo verificador automatizado de comandos e saídas reais nas resoluções, além de travar a aprovação sem parecer favorável.
- **Prioridade:** **P1 — ALTA**

### 2. Escopo
- **Módulos:** Módulo de Auditoria, Validador de Evidências, Relatório Executivo.
- **Funcionalidades:** Parser de evidências para blocos de código com exit code 0 na seção `## Resolução`, bloqueio de transição para `CONCLUÍDO` sem parecer `APROVADO`, integração de prévias via Gemini AI.
- **Arquivos:** `server/phase1/stateMachine.ts`, `server/centralReport.ts`, `server/geminiService.ts`, `src/components/AuditReviewView.tsx`.
- **Handoffs de Origem:** `HND-PLAT-01`, `HND-PLAT-05`.

### 3. Responsáveis
- **Agente Executor:** Especialista em QA & Auditoria (`agente-24` / `agente-08`).
- **Validador:** Coordenador Operacional e Orquestrador Humano.

### 4. Dependências
- **Onda Anterior:** Onda 1 homologada.

### 5. Execução
- **Ordem:** Implementar parser de evidências na máquina de estados; atualizar tela de revisão e relatório executivo.
- **Critérios de Conclusão:** Impossibilidade de marcar handoff como concluído com comando vazio ou simulado.

### 6. Validação
- **Testes:** Casos de teste unitários com resoluções válidas e resoluções rejeitadas por falta de comando/código de saída.
- **Evidências:** Pareceres emitidos em `central/ondas/<onda>/revisoes/`.

### 7. Checklist da Onda 2
- [ ] Parser de validação de comandos e códigos de retorno implementado.
- [ ] Trava da máquina de estados restringindo status `CONCLUÍDO` ao Agente 24.
- [ ] Interface `AuditReviewView.tsx` exibindo vereditos e justificativas com clareza.
- [ ] Relatório executivo HTML validado com sanitização contra XSS.
- [ ] Homologação do fluxo pelo Agente 24.

---

## ONDA 3 — ORQUESTRAÇÃO E EXECUÇÃO ROBUSTA

### 1. Identificação
- **ID:** `WAVE-3`
- **Nome:** Estabilização do Runtime de Agentes e Tolerância a Falhas
- **Objetivo:** Garantir que o despacho de agentes e a execução de swarms ocorram com isolamento total de worktrees, concorrência controlada e recuperação elegante de falhas.
- **Prioridade:** **P1 — ALTA**

### 2. Escopo
- **Módulos:** TaskQueue, AgentRuntime, Coordinator Engine, Worktree Manager.
- **Funcionalidades:** Limpeza de worktrees órfãos, controle estrito de locks com renovação de lease (`heartbeat`), tratamento de timeout em chamadas de CLI, fallback inteligente de providers.
- **Arquivos:** `server/coordinator.ts`, `server/taskQueue.ts`, `server/agentRuntime.ts`, `server/phase1/worktree.ts`.
- **Handoffs de Origem:** `HND-PLAT-01`, `HND-PLAT-08`.

### 3. Responsáveis
- **Agente Executor:** Arquiteto de Sistemas (`agente-00`).
- **Validador:** Agente 24.

### 4. Dependências
- **Onda Anterior:** Onda 2 concluída.

### 5. Execução
- **Ordem:** Adicionar rotinas de heartbeat para executores de longa duração; refatorar detecção de worktrees órfãos para oferecer deleção confirmada via UI.
- **Critérios de Conclusão:** Zero concorrência de checkout git entre dois agentes distintos.

### 6. Validação
- **Testes:** Simulação de interrupção abrupta de executor e verificação de recuperação de lock.
- **Evidências:** Logs de dry-run e real-run em `central/estado/coordinator-runs/`.

### 7. Checklist da Onda 3
- [ ] Limite de concorrência (`CENTRAL_MAX_CONCURRENCY`) validado sob carga.
- [ ] Rotina de heartbeat / renovação de lease funcional.
- [ ] Worktrees isolados criados e destruídos graciosamente.
- [ ] Proteção estrita de arquivos críticos (`server.ts`, `package.json`, `schema.prisma`).
- [ ] Relatórios de execução registrados em formato auditável.

---

## ONDA 4 — UX, UI E EXPERIÊNCIA OPERACIONAL

### 1. Identificação
- **ID:** `WAVE-4`
- **Nome:** Sala de Comando, Workspace de Bots e Higiene de UI
- **Objetivo:** Refinar a experiência visual e a usabilidade do desenvolvedor solo, remover código morto (`LandingPage.tsx` e `film.css`) e enriquecer o Workspace de Bots com suporte a destinatários reais.
- **Prioridade:** **P2 — MÉDIA**

### 2. Escopo
- **Módulos:** Frontend React, Componentes de Visualização, Design System.
- **Funcionalidades:** Arquivamento de código órfão, inclusão do campo `toAgentId` no Board do `AgentBotsWorkspace`, aviso de compatibilidade no comando de voz, verificação de responsividade.
- **Arquivos:** `src/components/AgentBotsWorkspace.tsx`, `src/components/LandingPage.tsx`, `src/film.css`, `src/types/governance.ts`, `src/components/ChatBootWidget.tsx`.
- **Handoffs de Origem:** `HND-PLAT-06`, `HND-PLAT-07`.

### 3. Responsáveis
- **Agente Executor:** Engenheiro Frontend / UI (`agente-02`).
- **Validador:** Orquestrador Humano e Agente 24.

### 4. Dependências
- **Aprovação Humana:** Confirmação de descarte ou arquivamento de `LandingPage.tsx`.

### 5. Execução
- **Ordem:** Isolar código legado; estender tipagem de mensagens de bots; aprimorar renderização do Board; validar consistência do tema dark.
- **Critérios de Conclusão:** Build limpo sem warnings, UI fluida e sem regressões visuais.

### 6. Validação
- **Testes:** `npm run build`, `npm run lint`.
- **Evidências:** Screenshots locais e inspeção visual pelo desenvolvedor.

### 7. Checklist da Onda 4
- [ ] Código órfão (`LandingPage.tsx`, `film.css`) devidamente saneado.
- [ ] Suporte a destinatário (`toAgentId`) refletido no Quadro de bots.
- [ ] ChatBootWidget operando com fallback sem erros em qualquer navegador.
- [ ] Dashboard mantendo 60 FPS com canvas de partículas e telemetria.
- [ ] Build de produção gerado sem falhas de chunk ou tipos.

---

## ONDA 5 — INTEGRAÇÕES E AUTOMAÇÕES

### 1. Identificação
- **ID:** `WAVE-5`
- **Nome:** Integração GitHub, Provedores de IA e Webhooks Seguros
- **Objetivo:** Parametrizar com segurança os conectores com GitHub (`gh` CLI / API), configurar notificações Discord/Slack e validar integração ao vivo com a API do Gemini.
- **Prioridade:** **P2 — MÉDIA**

### 2. Escopo
- **Módulos:** Integrações Externas, Webhooks, GitHub Client, Provedor Gemini.
- **Funcionalidades:** Trava de segurança para abertura de PRs pós-parecer 24, configuração segura de URLs de webhook, teste de integração ao vivo com `GEMINI_API_KEY`.
- **Arquivos:** `server/centralGithub.ts`, `server/centralNotify.ts`, `server/geminiService.ts`, `.env.example`.
- **Handoffs de Origem:** `HND-PLAT-04`, `HND-PLAT-11`.

### 3. Responsáveis
- **Agente Executor:** Especialista em Integrações e DevOps (`agente-10` / `agente-16`).
- **Validador:** Coordenador Operacional e Humano.

### 4. Dependências
- **Credenciais:** Chave `GEMINI_API_KEY` e URL de webhook fornecida pelo Humano.

### 5. Execução
- **Ordem:** Inserir trava no endpoint `/github/pr`; criar rotina de teste de conectividade de webhook; testar chamada real ao Gemini com tratamento gracioso de quota/ausência de chave.
- **Critérios de Conclusão:** Todas as integrações externas operando de forma não-bloqueante e resiliente.

### 6. Validação
- **Testes:** `server/centralEvents.test.ts`, `server/geminiService.test.ts`, teste de SSRF no webhook.
- **Evidências:** Logs de envio de eventos confirmados.

### 7. Checklist da Onda 5
- [ ] Trava de abertura de PR validada contra pareceres reprovados.
- [ ] Webhook testado contra endpoints HTTPS válidos com proteção SSRF.
- [ ] Integração com Gemini 2.5 Flash / Hydrogen funcional com fallback elegante.
- [ ] `.env.example` atualizado com todas as variáveis obrigatórias e opcionais.

---

## ONDA 6 — QUALIDADE, SEGURANÇA E HOMOLOGAÇÃO GERAL

### 1. Identificação
- **ID:** `WAVE-6`
- **Nome:** Homologação E2E, Auditoria de Segurança e Relatório de Prontidão
- **Objetivo:** Submeter a Central a um ciclo completo de auditoria interna, validação ponta a ponta e emissão do parecer final de prontidão operacional.
- **Prioridade:** **P1 — ALTA**

### 2. Escopo
- **Módulos:** Toda a plataforma da Central de Auditoria e Handoff.
- **Funcionalidades:** Testes de ponta a ponta (login -> criação de onda -> despacho -> evidência -> parecer 24 -> relatório), auditoria de segurança de credenciais, validação de TypeScript estrito.
- **Arquivos:** Toda a base de código e testes em `server/` e `src/`.
- **Handoffs de Origem:** Consolidação de todas as ondas anteriores.

### 3. Responsáveis
- **Agente Executor:** Agente 24 (Auditor Chefe Independente).
- **Validador:** Orquestrador Humano.

### 4. Dependências
- **Ondas Anteriores:** Conclusão formal das Ondas 0 a 5.

### 5. Execução
- **Ordem:** Execução de suíte completa de testes; verificação de vulnerabilidades (`npm audit`); validação do relatório HTML gerado; assinatura do parecer final.
- **Critérios de Conclusão:** 100% dos testes verdes, zero vulnerabilidades de alta severidade, parecer favorável emitido.

### 6. Validação
- **Testes:** `npm test`, `npm run lint`, `npm run build`, auditoria de segurança.
- **Evidências:** Relatório de homologação publicado em `central/RELATORIO-HOMOLOGACAO-FINAL.md`.

### 7. Checklist da Onda 6
- [ ] 89+ testes unitários e de integração verdes.
- [ ] `tsc --noEmit` executado com zero advertências ou erros.
- [ ] Build de produção gerado com integridade de assets.
- [ ] Fluxo ponta a ponta de auditoria e handoffs comprovado em smoke test.
- [ ] Credenciais padrão saneadas e protegidas.
- [ ] Relatório Executivo de Prontidão aprovado e assinado pelo Agente 24.
- [ ] Homologação formal concedida pelo Orquestrador Humano.
