# Ondas de auditoria

| Onda | Path | Status | Veredito | Handoffs |
|---|---|---|---|---|
| release-readiness-2026-11-18 | `ondas/release-readiness-2026-11-18/` | EM_ANDAMENTO (Etapa 0 pendente) | NO-GO | 18 |

## Como criar uma nova onda

1. `mkdir ondas/<nome-da-onda>/{auditoria,handoffs,revisoes}`
2. Copiar/adaptar `TEMPLATE-HANDOFF.md` para cada achado → `handoffs/` + `INDEX.md` da onda.
3. Adicionar linha nesta tabela.
4. Atualizar `estado/central-state.json` → `activeWave`.
5. Acionar o coordenador.
