# CHECKLIST MESTRE DE VERIFICAÇÃO DA CENTRAL
**Critérios Auditáveis de Integridade, Governança e Homologação**
*Versão: 2.0 | Data: 2026-11-21 | Status: AUDITÁVEL*

---

## 1. DOCUMENTAÇÃO E GOVERNANÇA

- [x] **DOC-01:** Todos os handoffs de encerramento das conversas anteriores foram localizados e catalogados (`central/INVENTARIO-HANDOFFS-ENCERRADOS.md`).
- [x] **DOC-02:** Relatório de validação documental vs. evidências reais emitido sem omissões (`central/RELATORIO-VALIDACAO-HANDOFFS.md`).
- [x] **DOC-03:** Documentos de governança (`PRODUCT.md`, `DESIGN.md`, `COORDENADOR.md`) preservados e íntegros.
- [x] **DOC-04:** Registro formal de decisões humanas D-01 a D-07 estruturado (`central/REGISTRO-DECISOES.md`).
- [ ] **DOC-05:** PRs de documentação pendentes (#9, #10, #11, #12) homologados pelo Humano.
- [ ] **DOC-06:** Repositório alvo (`Birthub-360`) mantido estritamente isolado da base de código da Central.

---

## 2. BACKEND E PERSISTÊNCIA

- [x] **BCK-01:** Persistência atômica (`saveJsonAtomic`) e mutex file locking (`withFileLockSync`) implementados e testados contra stale locks.
- [x] **BCK-02:** Banco SQLite embutido (`node:sqlite`) inicializando corretamente com PRAGMA foreign_keys = ON e journal_mode = WAL.
- [x] **BCK-03:** Rotas de autenticação (`/api/auth/*`) com cookie HttpOnly e hashing scrypt protegendo todas as rotas `/api/*`.
- [x] **BCK-04:** Sandbox de sistema de arquivos (`/api/fs/*`) limitando leituras a 512KB e escritas a 2MB sob raízes autorizadas.
- [x] **BCK-05:** Semáforo FIFO de concorrência (`server/taskQueue.ts`) limitando execução simultânea ao teto configurado.
- [x] **BCK-06:** Graceful shutdown implementado com drenagem da fila em até 15s e encerramento seguro de conexões SQLite.
- [ ] **BCK-07:** Eliminação da duplicidade entre `centralExecutions.ts` (JSONL) e `phase1/executions.ts` (JSON).

---

## 3. AGENTES E ORQUESTRAÇÃO

- [x] **AGN-01:** Roster oficial de agentes cadastrado com papéis e identificadores únicos em `src/data/agentsRoster.ts` e `registry.json`.
- [x] **AGN-02:** Script de detecção automática de CLIs instaladas (`central/agents/detect-agents.mjs`) funcional.
- [x] **AGN-03:** Suporte a múltiplos modos de despacho (subagente, CLI headless, manual e API) configurado.
- [x] **AGN-04:** Isolamento estrito de agentes por git worktree dedicado (`server/phase1/worktree.ts`).
- [x] **AGN-05:** Regras de exclusão de slots (`01/01A`, `06/06A`, `08/08A`, `16/06/07`) ativas no coordenador.
- [ ] **AGN-06:** Higienização de locks residuais e rotina de renovação de lease (`heartbeat`) validada.

---

## 4. AUDITORIA E VALIDAÇÃO INDEPENDENTE

- [x] **AUD-01:** Máquina de estados formal (`server/phase1/stateMachine.ts`) impedindo saltos ilegais de status.
- [x] **AUD-02:** Estrutura oficial de relatórios de auditoria e pareceres do Agente 24 tipada e preservada.
- [x] **AUD-03:** Relatório executivo HTML standalone gerado via endpoint `/api/central/report` com sanitização HTML.
- [x] **AUD-04:** Integração para prévia de diagnóstico e emissão de pareceres assistidos por Gemini AI criada.
- [ ] **AUD-05:** Parser automatizado de comandos e códigos de saída (`exit 0`) integrado à validação da máquina de estados.
- [ ] **AUD-06:** Trava estrita de autorização impedindo que o executor aprove a própria entrega.

---

## 5. FRONTEND E INTERFACE (SALA DE COMANDO)

- [x] **UI-01:** Dashboard "Sala de Comando" com tela de boot, canvas de partículas interativo e telemetria de 14 dias operando a 60 FPS.
- [x] **UI-02:** View Transitions nativas implementadas na navegação entre as seções da Central.
- [x] **UI-03:** Widget de chat do coordenador flutuante com comando de voz nativo em português (Web Speech API).
- [x] **UI-04:** Explorador de arquivos e IDE sandboxed com syntax highlighting, status bar e salvamento seguro via `Ctrl+S`.
- [x] **UI-05:** Workspace de agentes com modos Membros, Quadro de traces ao vivo e Galeria de dossiers.
- [ ] **UI-06:** Saneamento definitivo de arquivos de componentes órfãos (`LandingPage.tsx` e `film.css`).
- [ ] **UI-07:** Persistência canônica do campo `toAgentId` no Board de mensagens de agentes.

---

## 6. INTEGRAÇÕES EXTERNAS

- [x] **INT-01:** Integração com GitHub PR (`server/centralGithub.ts`) suportando CLI `gh` nativa e fallback de API.
- [x] **INT-02:** Notificador webhook com proteção contra ataques de SSRF e bloqueio de IPs de loopback/rede interna.
- [x] **INT-03:** Suporte nativo ao SDK `@google/genai` com fallback não-bloqueante na ausência de credenciais.
- [ ] **INT-04:** Trava no endpoint `/api/central/github/pr` condicionando disparo a parecer favorável do Agente 24.
- [ ] **INT-05:** Configuração e homologação de URL de webhook real de produção no `.env`.

---

## 7. QUALIDADE, TESTES E SEGURANÇA

- [x] **QAS-01:** Suíte de testes automatizados (`npm test`) com **89 testes executados e 89 aprovados (0 falhas)**.
- [x] **QAS-02:** Checagem estrita de tipos TypeScript (`tsc --noEmit`) executada com **zero erros ou advertências**.
- [x] **QAS-03:** Build de produção (`vite build`) compilado com sucesso gerando bundles otimizados em `dist/`.
- [x] **QAS-04:** Raízes do sistema de arquivos devidamente encapsuladas sem vulnerabilidades de path traversal.
- [ ] **QAS-05:** Remoção ou proteção contra credencial de fallback `birthhub360` em ambientes não-locais.
- [ ] **QAS-06:** Teste de estresse concorrente sob carga máxima simultânea (`CENTRAL_MAX_CONCURRENCY`).
