# MATRIZ DE AGENTES, PROVEDORES E RESPONSABILIDADES
**Catálogo Operacional de Capacidades e Titularidades da Central**
*Versão: 2.0 | Data: 2026-11-21 | Status: HOMOLOGADO*

---

## 1. PRINCÍPIO DA MATRIZ DE AGENTES

A Central de Auditoria coordena múltiplos perfis de agentes especialistas e revisores independentes. Cada agente possui:
1. Um **papel funcional estrito** (arquétipo).
2. Um conjunto de **titularidades de arquivos** exclusivas.
3. Regras de **não-interferência** (proibição de modificar arquivos sob guarda de outros agentes).
4. Métodos de **despacho e execução** suportados pela plataforma.

---

## 2. PROVEDORES DE IA E MODOS DE DESPACHO

| ID Provedor | Nome do Provedor | Tipo de Integração | Ferramenta / CLI | Modo de Despacho | Limitações Conhecidas |
|---|---|---|---|---|---|
| **devin** | Devin Desktop / Subagente | `subagent` | `devin` CLI / subagent | Execução autônoma via `run_subagent profile=subagent_general` no worktree | Sessões dependem de API key ou console Desktop ativo |
| **claude-code** | Claude Code | `cli` | `claude` | Headless CLI: `claude -p "<prompt>" --dangerously-skip-permissions` | Exige instalação local do binário `claude` |
| **codex-cli** | OpenAI Codex CLI | `cli` | `codex` | Headless CLI: `codex exec "<prompt>"` | Requer chave OpenAI e CLI instalada |
| **antigravity** | Google Antigravity | `manual` | Prompt Package | Pacote gerado em `central/estado/fila/`; humano executa no Antigravity | Sem CLI headless conhecida; despacho manual assistido |
| **github-copilot** | GitHub Copilot | `manual` | VS Code Extension | Pacote gerado em `central/estado/fila/`; execução no IDE | Requer ação do desenvolvedor no VS Code |
| **gemini-api** | Google Gemini (SDK) | `api` | `google-genai` | Chamada direta via API (`gemini-2.5-flash` / `hydrogen`) | Operações puramente analíticas e emissão de pareceres |
| **chatgpt-api** | OpenAI ChatGPT API | `api` | REST / SDK | Endpoint `/v1/chat/completions` com chave configurada | Sem acesso direto ao sistema de arquivos |
| **grok-api** | xAI Grok API | `api` | REST / SDK | Endpoint compatível OpenAI com `XAI_API_KEY` | Sem acesso direto ao sistema de arquivos |

---

## 3. ROSTER OFICIAL DE AGENTES E TITULARIDADES

| ID | Codinome / Especialidade | Papel e Responsabilidades | Arquivos Sob Sua Guarda Exclusiva | Slots Exclusivos | Provedor Preferencial |
|---|---|---|---|---|---|
| **00** | **Coordenador Geral** | Orquestração, leitura de estado, seleção de lotes, despacho e acompanhamento. | `central/**`, `COORDENADOR.md`, `README.md`, `central-state.json` | Global (único) | Antigravity / Devin |
| **01** | **Arquiteto de Dados & RLS** | Modelagem Prisma, migrações SQL, isolamento de tenant, integridade referencial. | `prisma/schema.prisma`, `prisma/migrations/**`, `src/lib/db/**` | Slot `01/01A` | Devin / Claude |
| **01A** | **Confiabilidade & Retenção** | Políticas de retenção LGPD, expurgo de dados, integridade de auditoria. | Scripts de expurgo, jobs de retenção | Slot `01/01A` | Devin / Claude |
| **02** | **Designer & UX Engineer** | Interfaces de usuário, design system, completude de jornadas, acessibilidade. | `src/components/**`, `src/styles/**`, `src/views/**` | Slot `02/02A..D` | Devin / Antigravity |
| **04** | **Engenheiro de CRM & BI** | Regras de negócio de CRM, pipelines de vendas, integridade de contatos e BI. | `src/modules/crm/**`, `src/modules/bi/**` | Livre | Devin / Claude |
| **05** | **Especialista em Prospecção** | Cold email, enriquecimento de leads, prevenção a SSRF em webhooks de saída. | `src/modules/prospecting/**`, `src/lib/email/**` | Livre | Devin / Claude |
| **06** | **Integrador de Ecossistemas** | Conectores com Bitrix24, webhooks de entrada, sincronização bidirecional. | `src/integrations/bitrix/**`, `src/integrations/**` | Slot `06/06A`, `16/06` | Devin / Claude |
| **07** | **Engenheiro de IA & Custos** | Gateway de LLMs, fallbacks de modelo, teto de gastos, circuit breaker de IA. | `src/lib/ai/**`, `src/modules/ai-gateway/**` | Conflito `16/07` | Devin / Claude |
| **08** | **Especialista em QA & CI/CD** | Pipelines de automação de testes, gates de integração, Cypress/Playwright. | `.github/workflows/**`, `cypress/**`, `tests/e2e/**` | Slot `08/08A` | Devin / Claude |
| **09** | **Engenheiro Mobile** | App Android/iOS via Capacitor, deep links, assetlinks.json, permissões. | `android/**`, `ios/**`, `capacitor.config.ts` | Livre | Devin / Claude |
| **10** | **DevOps & Infraestrutura** | Deploy seguro, scripts de backup/restore PostgreSQL, healthchecks e rollback. | `scripts/deploy/**`, `scripts/backup/**`, `docker-compose*` | Livre | Devin / Claude |
| **12** | **Engenheiro de Telefonia & Voz** | Integração 3CX, processamento de áudio, transcrição e conformidade LGPD. | `src/modules/voice/**`, `src/modules/telephony/**` | Livre | Devin / Claude |
| **13** | **Governança de IA & Consentimento** | Gestão de consentimento titular, tabela `AiConsent`, auditoria de chamadas IA. | `src/modules/compliance/**`, contratos de consentimento | Livre | Devin / Claude |
| **15** | **Engenheiro de Segurança** | Proteção de rotas, middleware de autenticação/RBAC, sanitização e OWASP. | `src/middlewares/auth/**`, `src/lib/security/**` | Livre | Devin / Claude |
| **16** | **Engenheiro de Workers & Filas** | BullMQ, processamento assíncrono, expurgo de DLQ, escalonamento e métricas. | `src/lib/queue/**`, `src/workers/**` | Conflito `16/06/07` | Devin / Claude |
| **17** | **Engenheiro de Cadência** | Agendamento de contatos, throttling, limites de taxa de disparo. | `src/modules/cadence/**` | Livre | Devin / Claude |
| **18** | **Arquiteto de APIs & Contratos** | Especificações OpenAPI/Swagger, tipagem de contratos e validação de schema. | `docs/openapi/**`, `src/types/api/**` | Livre | Devin / Claude |
| **21** | **Oficial de Privacidade & LGPD** | Conformidade LGPD, termo de uso, anonimização e expurgo de áudio. | `docs/lgpd/**`, políticas de anonimização | Livre | Devin / Claude |
| **24** | **Auditor Chefe Independente** | **Revisão obrigatória de todas as entregas**. Emissão de pareceres independentes. | `central/ondas/*/revisoes/**`, `.agents/reviews/**` | Neutro / Independente | Agente 24 (`subagent_explore`) |

---

## 4. MATRIZ DE DESPACHO E MISSÕES PLANEJADAS

| ID Missão | Onda | Missão Técnica | Agente Designado | Dependências | Prioridade | Status |
|---|---|---|---|---|---|---|
| **MIS-00-01** | Onda 0 | Preservar alterações locais do repo em branch `feat/platform-sqlite-gemini-stats` | Agente 00 | Autorização humana | P0 | PENDENTE |
| **MIS-00-02** | Onda 0 | Higienizar e arquivar locks expirados de 19/11 em `central/estado/locks/archive/` | Agente 00 | MIS-00-01 | P0 | PENDENTE |
| **MIS-01-01** | Onda 1 | Unificar pipeline de logging de execuções (`centralExecutions` como canônico) | Agente 16 | Conclusão Onda 0 | P1 | PLANEJADO |
| **MIS-02-01** | Onda 2 | Implementar parser estrito de comandos e saídas reais na máquina de estados | Agente 24 | Conclusão Onda 1 | P1 | PLANEJADO |
| **MIS-03-01** | Onda 3 | Fortalecer semáforo de concorrência e heartbeat de execução no `taskQueue` | Agente 10 | Conclusão Onda 2 | P1 | PLANEJADO |
| **MIS-04-01** | Onda 4 | Saneamento de código órfão (`LandingPage.tsx`) e suporte a `toAgentId` no Board | Agente 02 | Aval humano | P2 | PLANEJADO |
| **MIS-05-01** | Onda 5 | Implementar trava de segurança para emissão de PRs vinculada ao Parecer 24 | Agente 15 | Conclusão Onda 2 | P1 | PLANEJADO |
| **MIS-06-01** | Onda 6 | Homologação E2E ponta a ponta e emissão do Relatório de Prontidão da Central | Agente 24 | Conclusão Onda 5 | P0 | PLANEJADO |

---

## 5. REGRAS ABSOLUTAS DE REVISÃO E ACEITE

1. **Veto do Revisor:** Nenhuma entrega é promovida para `CONCLUÍDO` sem parecer favorável explícito do Agente 24.
2. **Proibição de Auto-Aprovação:** O agente executor jamais emite ou assina seu próprio parecer de revisão.
3. **Proibição de Merge Direto:** Agentes executores são expressamente proibidos de executar comandos de push para `main` ou merges automáticos de PRs.
