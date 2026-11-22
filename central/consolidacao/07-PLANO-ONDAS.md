# 07 — PLANO DE ONDAS

As ondas 0–7 sugeridas na missão foram **readequadas à realidade diagnosticada**: a plataforma já tem Fases 1–4 implementadas (não é preciso "construir fundação"); o gargalo real é (a) preservar trabalho não commitado, (b) reconciliar o estado da onda do produto e (c) concluir a remediação Birthub. As ondas abaixo substituem a numeração sugerida — mapeamento em §final.

---

## ONDA A — PRESERVAÇÃO E VERDADE (equivale à Onda 0 sugerida)

**Objetivo:** eliminar risco de perda e estabelecer fonte de verdade única.

**Escopo:**
- CENTRAL-0001: commit do trabalho Gemini/chat em branch dedicada + handoff da sessão interrompida.
- CENTRAL-0003/0004: saneamento de locks/fila/estado + correção de INDEXs e central-state.json.
- CENTRAL-0021/0023/0024: reconciliação diff-a-diff das branches `agente/*`, verificação física dos worktrees `ag-*`, resolução do handoff 15.
- CENTRAL-0022: revisão 24 dos 4 AGUARDANDO_24 (paralela, read-only).

**Entregas:** working tree limpa; estado consistente; lista definitiva do que existe em cada branch `agente/*`; 4 pareceres 24.

**Dependências:** nenhuma para início. D-01/D-04 podem ser cobradas em paralelo (não bloqueiam A).

**Riscos:** descobrir commits nos worktrees `ag-01a/02/04/05` → muda o plano de re-despacho; conteúdo de branches antigas já parcialmente mergeado → retrabalho evitado pela reconciliação.

**Branches:** plataforma → `chore/consolidacao-preservacao-20261122`; produto → somente leitura nesta onda.

**Gate de entrada:** autorização humana para commitar o trabalho alheio (CENTRAL-0001) e acesso read-only ao repo produto.
**Gate de saída:** `git status` limpo na Central; relatório de reconciliação de branches; pareceres 24 registrados em `revisoes/` ou fila processada.

---

## ONDA B — HANDOFFS E AUDITORIA DO PRODUTO (equivale às Ondas 2+6 parciais)

**Objetivo:** fechar a onda release-readiness-2026-11-18 no produto.

**Escopo:**
- Re-despachar lote 2 (01A/02/04/05) conforme achados da Onda A.
- Despachar os 10 PENDENTE respeitando dependências e slots (ver 09).
- Criar handoffs derivados: RLS/migrations (CENTRAL-0026a — **P0 segurança**), clusters mobile DEBT-0025, ARQ-13 waivers (CENTRAL-0020 — **urgente 30/11**).
- Fechar pendências dos pareceres 24 anteriores.

**Sequência interna:**
1. CENTRAL-0026a RLS/migrations (P0) — sozinho no slot 01 (01A espera).
2. Em paralelo (máx 4): 06+DEBT-0020, 07, 12, 13 (após D-05 — já respondida).
3. Em paralelo: 17, 18, 21 (após 13), 15 (após CENTRAL-0024), 08 (qa-gates + ARQ-13), 00 (higiene).
4. 02/04/05 re-despachados conforme Onda A.
5. Revisão 24 de cada entrega → CONCLUÍDO.

**Dependências:** Onda A concluída; D-04 ratificada (01A); slots exclusivos.

**Riscos:** branches `agente/*` divergentes → mitigado por B1 da Onda A; P1s de segurança (SSRF, segredo 3CX, consentimento) são pré-requisito de GO.

**Gate de saída:** todos os handoffs em estado terminal; pareceres 24; evidência de gates por entrega.

---

## ONDA C — INTEGRAÇÃO, HOMOLOGAÇÃO E RELEASE (equivale às Ondas 5+6+7)

**Objetivo:** integrar tudo e re-emitir veredito.

**Escopo:**
- Merge order aprovada no produto (#401/#413→#415→saneamento→antigos→docs) + PRs #473–476 pós-parecer.
- Gates de integração: tsc/lint/testes/build do produto + smoke.
- Drills: restore de backup real (CENTRAL-0029), envs EC2 (CENTRAL-0028/D-01).
- assetlinks.json/DNS (CENTRAL-0030).
- Re-veredito GO/NO-GO com evidência.

**Dependências:** Onda B; decisões humanas D-01/D-04; acesso ao host.

**Gate de saída:** veredito formal + checklist de prontidão (10-CHECKLIST) completo.

---

## ONDA D — PLATAFORMA: ROBUSTEZ PÓS-CONSOLIDAÇÃO (equivale às Ondas 1+3+4 sugeridas, já parcialmente feitas)

**Objetivo:** saneamento técnico da Central após a consolidação.

**Escopo:** DT-01..DT-07 do diagnóstico (backlog CENTRAL-0005..0016), multi-usuário se priorizado, code-splitting, remoção de órfãos.

**Dependências:** Onda A (estado limpo); decisões de versionamento.
**Paralelismo:** quase tudo independente da Onda B — pode rodar em paralelo com agentes diferentes.

---

## Ondas sugeridas não adotadas (e por quê)

- **Onda 1 "Fundação"** (backend/persistência/contratos/CI): a fundação já existe e está testada; o que falta são correções pontuais → absorvidas na Onda D.
- **Onda 3 "Agentes e orquestração"**: locks/state machine/adapters já implementados; pendente apenas heartbeat/output (CENTRAL-0007, P3) → Onda D.
- **Onda 4 "UX/UI"**: dashboard, swarm suite, sala de comando já entregues; pendente aceite visual do swarm (decisão do usuário) e ajustes finos → Onda D.
- **Onda 5 "Integrações"**: GitHub funcional, Gemini funcional-não-commitado, webhook sem URL → Onda D + decisões humanas.

## Matriz onda × backlog

| Onda | Itens principais |
|---|---|
| A | CENTRAL-0001, 0003, 0004, 0021, 0022, 0023, 0024 |
| B | CENTRAL-0020, 0025, 0026, 0027, 0031, 0032 |
| C | CENTRAL-0028, 0029, 0030 + gates |
| D | CENTRAL-0002*, 0005–0016 (*0002 pode ser resolvido já na Onda A se o humano decidir) |
