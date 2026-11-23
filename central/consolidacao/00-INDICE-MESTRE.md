# 00 — ÍNDICE MESTRE DA CONSOLIDAÇÃO GLOBAL

**Data da consolidação:** 2026-11-22
**Agente autor:** Devin (SWE-2 Flash Medium), Agente 00 — Coordenador Global da Central de Auditoria e Handoffs
**Missão:** Consolidação integral dos handoffs, verificação de evidências, diagnóstico operacional e planejamento de execução por ondas.
**Escopo executado:** leitura, diagnóstico e documentação de planejamento. **Nenhuma implementação, despacho, merge, push ou alteração de código foi executada.**

---

## Como usar este conjunto

1. Comece por `17-RELATORIO-EXECUTIVO.md` (visão em 2 minutos) e `01-ESTADO-GLOBAL-CENTRAL.md` (fotografia forense).
2. `15-MEMORIA-OPERACIONAL.md` é o documento de continuidade — a próxima sessão coordenadora deve lê-lo primeiro.
3. `05-BACKLOG-MESTRE.md` é a fonte única de pendências (IDs `CENTRAL-XXXX`).
4. `12-DECISOES-HUMANAS.md` lista tudo que depende do Orquestrador Humano — nada ali foi aprovado por inferência.
5. `16-PROXIMOS-DESPACHOS.md` contém as missões preparadas, **não executadas**.

## Documentos

| # | Arquivo | Conteúdo |
|---|---|---|
| 00 | `00-INDICE-MESTRE.md` | Este índice |
| 01 | `01-ESTADO-GLOBAL-CENTRAL.md` | Fotografia forense Git/operacional |
| 02 | `02-INVENTARIO-HANDOFFS.md` | Inventário integral de handoffs e docs de continuidade |
| 03 | `03-RELATORIO-VALIDACAO.md` | Validação documental/técnica/governança por handoff |
| 04 | `04-DIAGNOSTICO-TECNICO.md` | Diagnóstico da plataforma Central + estado do produto auditado |
| 05 | `05-BACKLOG-MESTRE.md` | Backlog único `CENTRAL-XXXX`, priorizado |
| 06 | `06-PLANO-MESTRE-EXECUCAO.md` | Plano operacional e caminho crítico |
| 07 | `07-PLANO-ONDAS.md` | Ondas detalhadas com gates de entrada/saída |
| 08 | `08-MATRIZ-AGENTES.md` | Agentes/provedores disponíveis e matriz de despacho |
| 09 | `09-MATRIZ-DEPENDENCIAS.md` | Dependências, bloqueios e paralelismo seguro |
| 10 | `10-CHECKLIST-MESTRE.md` | Checklists por tarefa + matriz de prontidão |
| 11 | `11-MATRIZ-RISCOS.md` | Riscos, probabilidade, impacto, mitigação |
| 12 | `12-DECISOES-HUMANAS.md` | Decisões reservadas ao Orquestrador Humano |
| 13 | `13-PLANO-TESTES.md` | Plano de testes e homologação |
| 14 | `14-PLANO-INTEGRACAO.md` | Plano de branches, PRs e merges |
| 15 | `15-MEMORIA-OPERACIONAL.md` | Memória autocontida para a próxima sessão |
| 16 | `16-PROXIMOS-DESPACHOS.md` | Missões preparadas para aprovação |
| 17 | `17-RELATORIO-EXECUTIVO.md` | Relatório executivo final (seções A–O) |

## Fontes de verdade (não duplicar)

- Estado operacional da onda Birthub: `central/estado/central-state.json`, `central/estado/worktrees.json`, `central/estado/locks/`, `central/estado/fila/`, `central/estado/executions/`
- Decisões humanas: `central/decisoes/PENDENTES.md`
- Handoffs da onda: `central/ondas/release-readiness-2026-11-18/handoffs/` (+ `auditoria/`, `revisoes/`)
- Checklist verificado item a item (fonte da auditoria de 22/11): `CHECKLIST-HANDOFFS-RELEASE-READINESS.html` (raiz do repo)
- Governança: `central/COORDENADOR.md`, `central/README.md`, `central/TEMPLATE-HANDOFF.md`
- Consolidado anterior da onda: `central/HANDOFF-ENCERRAMENTO-20261120.md`

## Arquivo histórico

`central/consolidacao-antigravity-20261121/` — consolidação anterior produzida por sessão Antigravity em 21/11, preservada antes da remoção do worktree. **Não é fonte de verdade**; a fonte é esta pasta (00–17).

## Avisos

- Os documentos desta pasta foram escritos na working tree. **Estado de versionamento: ver `01-ESTADO-GLOBAL-CENTRAL.md` §Versionamento** — não assumir commit/push.
- O working tree contém alterações de **outra sessão** (trabalho não commitado de 21/11 — provedor Gemini + persistência de chat + ajustes de UI). Elas foram preservadas intocadas e registradas em `04-DIAGNOSTICO-TECNICO.md` e `05-BACKLOG-MESTRE.md` (CENTRAL-0001).
