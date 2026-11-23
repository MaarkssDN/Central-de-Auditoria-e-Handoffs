# 06 — PLANO MESTRE DE EXECUÇÃO

## Estratégia

Duas trilhas independentes que se cruzam apenas na governança:

- **Trilha P (plataforma):** primeiro **congelar o trabalho não commitado** (CENTRAL-0001) — é o único item com risco de perda ativo. Depois saneamento de estado e decisões de versionamento.
- **Trilha B (produto):** primeiro **reconciliar a verdade** (branches × main, estado dos EM_EXECUÇÃO) antes de qualquer novo despacho — re-despachar sem reconciliar repete o erro que gerou os "EM_EXECUÇÃO fantasma".

**Princípio:** nenhuma onda de implementação começa sem gate de entrada verificado. Toda entrega exige evidência (comando+exit code) e, para o produto, parecer do Agente 24.

## Sequência do caminho crítico

```
FASE A — PRESERVAÇÃO (imediata, ~1 sessão)
  A1. CENTRAL-0001: commitar trabalho Gemini/chat em branch própria + handoff da sessão
  A2. CENTRAL-0002/0005/0010/0012/0013/0014: decisões humanas (lote único de perguntas)
  A3. CENTRAL-0028: D-01/D-04 do produto
        │
FASE B — VERDADE (antes de qualquer despacho)
  B1. CENTRAL-0021: reconciliar branches agente/* × main (diff-a-diff)
  B2. CENTRAL-0023: verificar worktrees ag-01a/02/04/05 — commits? execuções mortas?
  B3. CENTRAL-0024: resolver inconsistência do handoff 15
  B4. CENTRAL-0022: revisão 24 dos 4 AGUARDANDO_24 (pode rodar em paralelo a B1–B3 — não toca código)
  B5. CENTRAL-0003/0004: saneamento de estado + docs-fonte
        │
FASE C — EXECUÇÃO DO PRODUTO (ondas B1–B3 abaixo)
  C1. Re-despachar lote 2 morto (01A/02/04/05) — conforme resultado de B2
  C2. Despachar PENDENTE respeitando slots/dependências (ver 09)
  C3. Criar handoffs derivados (RLS/migrations, mobile clusters, ARQ-13)
        │
FASE D — INTEGRAÇÃO E HOMOLOGAÇÃO
  D1. Pareceres 24 → CONCLUÍDO
  D2. Merge order aprovada + PRs #473–476 + docs #9–12
  D3. Gates de integração completos → re-veredito GO/NO-GO
```

## Paralelismo seguro

- **Podem rodar juntos:** CENTRAL-0001 (plataforma) ∥ CENTRAL-0022 (revisões 24 — read-only) ∥ CENTRAL-0021 (reconciliação — read-only).
- **NÃO podem:** dois executores no mesmo worktree; 01+01A, 06+06A, 08+08A simultâneos; qualquer despacho antes de B1–B3; merge de PRs antes de pareceres 24.
- **Conflito de arquivos provável:** `server/centralApi.ts`, `server/db.ts`, `src/components/*` — o trabalho não commitado (CENTRAL-0001) deve ser commitado **antes** de qualquer outra sessão tocar esses arquivos.

## Critérios de conclusão do plano (gate de saída global)

1. Working tree limpa ou todo trabalho commitado com handoff.
2. `central-state.json` e INDEXs refletindo a realidade.
3. Todos os 19 handoffs da onda em estado terminal verificável (CONCLUÍDO c/ parecer 24, REPROVADO_24, ou BLOQUEADO justificado).
4. PRs #9–12 do repo Central mergeados ou fechados formalmente.
5. PRs do produto reconciliados na ordem aprovada.
6. Re-veredito de release emitido com evidência.

## Decisões que dependem do humano (resumo — detalhe em 12)

- Destino dos PRs #9–12 e das branches obsoletas/worktrees.
- Política de versionamento de `central/estado/`.
- Senha admin, webhook, landing órfã, multi-usuário.
- D-01 (envs EC2), D-04 (ratificar retenções), drop do stash, merges do produto.
