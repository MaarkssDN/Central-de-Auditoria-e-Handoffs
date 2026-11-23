# MATRIZ DE RISCOS E TRATAMENTOS TÉCNICOS
**Catálogo de Riscos da Central de Auditoria e Handoff**
*Versão: 2.0 | Data: 2026-11-21 | Status: AUDITADO*

---

## 1. QUADRO DE CLASSIFICAÇÃO DE RISCOS

| ID Risco | Descrição do Risco | Evidência Identificada | Probabilidade | Impacto | Severidade | Responsável | Tratamento Recomendado | Status |
|---|---|---|---|---|---|---|---|---|
| **RSK-01** | **Perda de trabalho local não commitado no repositório principal** | `git status` no repo canônico aponta 15 arquivos modificados e 15 untracked contendo novas rotas, SQLite e Gemini. | Alta | Crítico | **CRÍTICA** | Coordenador Operacional | Criar imediatamente a branch `feat/platform-sqlite-gemini-stats` e commitar as alterações na Onda 0. | **EM_TRATAMENTO** |
| **RSK-02** | **Concorrência e execução duplicada por locks residuais expirados** | Arquivos de lock em `central/estado/locks/` datam de 19/11 e expiraram há mais de 40 horas. | Média | Alto | **ALTA** | Coordenador Operacional | Mover locks para pasta `archive/` e atualizar `central-state.json` antes de novos despachos. | **EM_TRATAMENTO** |
| **RSK-03** | **Abertura precipitada de PR no GitHub sem parecer favorável do Agente 24** | Endpoint `POST /api/central/github/pr` não verifica existência de parecer `APROVADO`. | Média | Alto | **ALTA** | Engenheiro de Plataforma | Implementar middleware validador de parecer 24 no endpoint de abertura de PR. | **PLANEJADO** |
| **RSK-04** | **Assimetria de dados entre logs JSONL e logs JSON por id** | Existência concorrente de `centralExecutions.ts` e `phase1/executions.ts`. | Alta | Médio | **MÉDIA** | Arquiteto de Software | Unificar pipeline tornando o formato JSONL diário a fonte única de verdade. | **PLANEJADO** |
| **RSK-05** | **Uso indevido de senha de desenvolvimento padrão (`birthhub360`)** | Fallback padrão codificado em `server/auth.ts`. | Baixa | Alto | **MÉDIA** | Engenheiro de Segurança | Emitir alerta no boot e proibir inicialização externa se `CENTRAL_ADMIN_PASSWORD` não for definida. | **PLANEJADO** |
| **RSK-06** | **Discrepância entre status de handoff e execução real (Caso Handoff 15)** | Relatório da CLI indicou exit 0 em 19/11, mas markdown permanece como `PENDENTE`. | Baixa | Médio | **MÉDIA** | Auditor Chefe (24) | Inspecionar branch do agente 15 no repositório alvo e sincronizar status formal. | **PLANEJADO** |
| **RSK-07** | **Inconsistência de dependências em novos git worktrees** | Worktree atual não continha `node_modules`, causando falha temporária em scripts locais. | Média | Baixo | **BAIXA** | DevOps / Plataforma | Documentar protocolo de checkout ou criar symlink de `node_modules` para worktrees da Central. | **MITIGADO** |
| **RSK-08** | **Expiração iminente dos waivers de vulnerabilidade Trivy (ARQ-13)** | Waivers de segurança no projeto auditado expiram em 2026-11-30. | Alta | Alto | **ALTA** | Auditoria Externa | Notificar o Humano para renovação ou correção das dependências vulneráveis antes do release. | **MONITORADO** |
| **RSK-09** | **Falha de execução do restore real de banco de dados (D-01)** | Scripts implementados de forma fail-closed, mas sem drill em ambiente real EC2. | Alta | Crítico | **ALTA** | DevOps / Humano | Exigir validação em staging antes de considerar o débito DEBT-0002 concluído. | **BLOQUEADO_HUMANO** |
| **RSK-10** | **Expurgo indevido de dados por janelas de retenção não ratificadas (D-04)** | Proposta de defaults LGPD em `PENDENTES.md` sem ratificação jurídica formal. | Média | Crítico | **ALTA** | Orquestrador Humano | Manter módulo de expurgo desativado em produção até ratificação expressa de D-04. | **BLOQUEADO_HUMANO** |

---

## 2. PROTOCOLO DE ESCALAÇÃO DE RISCOS

1. Riscos de severidade **CRÍTICA** paralisam novos despachos imediatamente.
2. Riscos de severidade **ALTA** exigem plano de contingência registrado antes da promoção de onda.
3. Riscos com dependência humana não podem ser mitigados por suposições de agentes.
