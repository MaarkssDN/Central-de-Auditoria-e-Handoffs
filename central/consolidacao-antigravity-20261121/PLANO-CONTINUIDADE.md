# PLANO DE CONTINUIDADE OPERACIONAL E GOVERNANÇA
**Protocolo de Transferência, Recuperação de Desastres e Operação Contínua**
*Versão: 2.0 | Data: 2026-11-21 | Status: HOMOLOGADO*

---

## 1. PROTOCOLO DE ASSUNÇÃO DE SESSÃO

Sempre que um novo agente coordenador ou desenvolvedor assumir a operação da Central, deve executar estritamente a seguinte sequência de inicialização:

1. **Reconhecimento do Ambiente:**
   - Confirmar o repositório canônico: `C:\Github\Central-de-Auditoria-e-Handoffs`.
   - Executar `git status` e `git branch` para verificar integridade e alterações não commitadas.
   - Detectar CLIs e agentes disponíveis: `node central/agents/detect-agents.mjs`.
2. **Leitura da Fonte de Verdade:**
   - Ler `central/estado/central-state.json` (checkpoint global e status de ondas).
   - Ler `central/INDEX.md` e `central/decisoes/PENDENTES.md` (decisões humanas vigentes).
   - Inspecionar a pasta `central/estado/locks/` para validar se há agentes ativos.
3. **Validação de Integridade do Código:**
   - Executar `npm test` para certificar que os 89 testes continuam verdes.
   - Executar `npm run lint` para confirmar zero erros de TypeScript.
4. **Relatório de Abertura:**
   - Reportar ao Orquestrador Humano em até 5 linhas: estado da Central, locks ativos, pendências humanas e próxima ação recomendada.

---

## 2. RECUPERAÇÃO DE FALHAS E DESASTRES (RUNBOOKS)

### 2.1. Runbook R1 — Recuperação de Lock Órfão ou Sessão Travada
- **Sintoma:** Um handoff permanece em `EM_EXECUÇÃO` ou rota retorna HTTP 409 após o agente ter sido interrompido.
- **Procedimento:**
  1. Verificar o arquivo em `central/estado/locks/<hash>.json` e conferir o campo `expiresAt`.
  2. Se `expiresAt < now`, o lock pode ser roubado via API (`POST /api/central/locks/claim` com `steal: true`) ou movido manualmente para `central/estado/locks/archive/`.
  3. Verificar o arquivo de handoff markdown correspondente; se não houver seção `## Resolução` preenchida, reverter o status para `PENDENTE`.
  4. Inspecionar o worktree associado; se estiver inativo, mantê-lo para reaproveitamento ou limpar via `git worktree remove`.

### 2.2. Runbook R2 — Recuperação de Integridade do Banco SQLite
- **Sintoma:** Endpoint `/api/health` retorna erro de integridade ou SQLite locked.
- **Procedimento:**
  1. O banco SQLite opera em modo WAL (`data/central.db-wal` e `data/central.db-shm`).
  2. Executar `PRAGMA integrity_check;` via Node.js script.
  3. Caso haja arquivo `.lock` residual em `data/.locks/`, verificar se o processo dono ainda existe. Em caso negativo, remover o arquivo de lock stale.
  4. Se corrompido, restaurar a partir do snapshot diário ou recriar (o banco é projetado para auto-recuperação das tabelas essenciais no boot).

### 2.3. Runbook R3 — Porta em Uso (Conflito de Instâncias)
- **Sintoma:** Servidor falha ao iniciar na porta 3000 com `EADDRINUSE`.
- **Procedimento:**
  1. A Central possui fallback inteligente para `PORT=3100` ou `PORT=3123`.
  2. Para identificar a instância em execução no Windows:
     `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object OwningProcess`
  3. Se for uma instância zumbi, encerrar o processo ou iniciar explicitamente em outra porta: `PORT=3123 npm run dev`.

---

## 3. CHECKLIST PARA ENCERRAMENTO DE TURNO

Ao finalizar uma sessão operacional da Central:
- [ ] Nenhum arquivo temporário ou resíduo de smoke test deixado em `central/`.
- [ ] Handoffs alterados tiveram seu `Status:` e `## Resolução` fielmente documentados.
- [ ] Locks concluídos foram liberados via `POST /api/central/locks/release`.
- [ ] Checkpoint em `central/estado/central-state.json` atualizado com o próximo passo exato.
- [ ] Git status verificado e reportado ao Orquestrador Humano.
