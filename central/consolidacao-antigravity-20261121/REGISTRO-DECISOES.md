# REGISTRO MESTRE DE DECISÕES HUMANAS
**Repositório de Decisões do Orquestrador Humano**
*Versão: 2.0 | Data de Atualização: 2026-11-21 | Status: AUDITADO*

---

## 1. QUADRO RESUMO DE DECISÕES

| ID | Assunto | Contexto e Impacto | Estado da Aprovação |
|---|---|---|---|
| **D-01** | Envs de Produção EC2 | Verificação de chaves e variáveis no host EC2. Bloqueia DEBT-0003, 0006, 0007, INF-04. | **PENDENTE (Default Conservador Ativo)** |
| **D-02** | Escopo Day-1: Mobile / Capacitor | Inclusão do app Android no release Day-1. Promove DEBT-0004 a bloqueador real. | **APROVADO (SIM — entra no escopo)** |
| **D-03** | Escopo Day-1: Voz & Enxame IA | Inclusão de telefonia e agentes autônomos de IA no escopo do lançamento. | **APROVADO (SIM — entram no escopo)** |
| **D-04** | Janelas Oficiais de Retenção (LGPD) | Prazos de expurgo de AuditLog, AILog, WhatsApp, etc. Bloqueia DEBT-0021. | **PENDENTE (Proposta de Defaults Aguardando)** |
| **D-05** | Consentimento de IA Titular (DEBT-0013)| Tabela persistida `AiConsent` com timestamp x allowlist de env global. | **APROVADO (Persistir no Banco de Dados)** |
| **D-06** | Veredito de Módulos Gated | Reintegração vs remoção de voice, proposals, design-lab. | **APROVADO (Todos Liberados / Reintegrados)** |
| **D-07** | Reconciliação Git do Alvo (Etapa 0) | Ordem de merge de PRs antigos e salvamento de stash. | **APROVADO / CONCLUÍDO (Etapa 0 Executada)** |
| **D-08** | Destino dos PRs #9, #10, #11 e #12 da Central | 4 PRs de documentação abertos por sessões anteriores no repo da Central. | **NOVA — PENDENTE DE DECISÃO HUMANA** |
| **D-09** | Autorização para Commit do Trabalho Local | Alterações uncommitted em `C:\Github\Central-de-Auditoria-e-Handoffs`. | **NOVA — PENDENTE DE DECISÃO HUMANA** |
| **D-10** | Saneamento de Código Órfão da UI | Arquivamento ou exclusão definitiva de `LandingPage.tsx` e `film.css`. | **NOVA — PENDENTE DE DECISÃO HUMANA** |

---

## 2. DETALHAMENTO DAS DECISÕES

### Decisão D-01 — Envs de Produção EC2
- **Contexto:** Necessidade de confirmar no servidor host se variáveis críticas (`BITRIX24_WEBHOOK_URL`, `THREECX_WEBHOOK_SECRET`, `PII_BLIND_INDEX_KEY`, etc.) estão declaradas.
- **Alternativas:** (A) Acessar o host e validar; (B) Manter default conservador considerando-as ausentes.
- **Impacto & Riscos:** Como ausentes, a severidade permanece ALTA e deploy automatizado fica travado.
- **Recomendação Técnica:** Manter default conservador até que o Humano valide no host EC2.
- **Estado:** **PENDENTE (Default Conservador Ativo desde 2026-11-19)**.

### Decisão D-04 — Janelas Oficiais de Retenção (LGPD)
- **Contexto:** Definir dias de retenção para: `AuditLog` (730d), `AILog` (365d), `SyncLogs` (180d), `AgentMemory` (90d), `WhatsApp/Timeline` (365d), `EnrichmentLog` (180d).
- **Impacto & Riscos:** O job de expurgo só pode rodar em produção com ratificação jurídica formal.
- **Recomendação Técnica:** Aprovar a proposta de defaults para desbloquear a implementação do Agente 01A.
- **Estado:** **PENDENTE (Proposta de defaults formulada, aguardando ratificação formal)**.

### Decisão D-08 — Homologação dos PRs #9, #10, #11 e #12 da Central
- **Contexto:** Quatro PRs documentais criados por sessões Devin concorrentes estão abertos no repositório `Central-de-Auditoria-e-Handoffs`.
- **Alternativas:**
  1. Realizar merge formal de todos os 4 PRs para manter registro histórico completo.
  2. Fechar os 4 PRs sem merge, considerando que esta consolidação mestre absorveu integralmente seu conteúdo.
- **Recomendação Técnica:** Alternativa 1 (merge sequencial rápido sem conflitos, pois tratam-se de novos arquivos `.md` isolados).
- **Estado:** **NOVA — PENDENTE DE DECISÃO DO HUMANO**.

### Decisão D-09 — Autorização de Commit do Trabalho Local Uncommitted
- **Contexto:** A working tree do repositório canônico contém 869 linhas adicionadas de código funcional (SQLite stats, Gemini service, testes e melhorias de UI) sem commit.
- **Alternativas:**
  1. Autorizar a criação de branch `feat/platform-sqlite-gemini-stats` e commit imediato.
  2. Descartar as alterações (`git reset --hard`) — **DESACONSELHADO / VIOLAÇÃO DE PRESERVAÇÃO**.
- **Recomendação Técnica:** Alternativa 1 imediata na Onda 0.
- **Estado:** **NOVA — PENDENTE DE DECISÃO DO HUMANO**.

### Decisão D-10 — Destino de `LandingPage.tsx` e `film.css`
- **Contexto:** Arquivos herdados do experimento de landing page anterior, atualmente desacoplados do aplicativo.
- **Alternativas:**
  1. Mover para subdiretório `src/legacy/` preservando referência visual.
  2. Excluir definitivamente da árvore de arquivos.
- **Recomendação Técnica:** Alternativa 1 (mover para legacy na Onda 4).
- **Estado:** **NOVA — PENDENTE DE DECISÃO DO HUMANO**.
