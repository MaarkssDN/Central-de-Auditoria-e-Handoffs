- De: 00 (Coordenador)
- Para: 10 (Infra/SRE) + 08 (QA)
- Status: AGUARDANDO_24
- Prioridade: P0

## Achados

### DEBT-0001 — Deploy EC2 sem migrate deploy nem healthcheck — P0
`deploy-ec2.sh:24-48`: scp dist+node_modules + `docker restart birthhub-app`. Sem `prisma migrate deploy`, sem healthcheck, sem tag de imagem. Viola B-05. Doc `DEPLOY_EC2.md` afirma healthcheck que não existe.
**Correção:** `docker exec birthhub-app npx prisma migrate deploy` antes do restart; curl `/health/ready` fail-closed; versionar `birthhub-app:<sha>`.
**Aceite:** deploy de teste aplica migration e falha o script se healthcheck não responder.
**Dono:** 10 (script) + 08 (verificação CI). Relatório: `auditoria/infra-ci-mobile-marca.md` INF-01/03.

### DEBT-0002 — Zero backup real; stubs reportam sucesso falso — P0
`PRODUCTION_ARCHITECTURE.md` admite sem backup. `backup-encrypted.sh` escreve placeholder; `restore-test.sh` só imprime sucesso; `dr-simulation.sh`/`rollback-drill.sh` constantes hardcoded.
**Correção:** pg_dump real agendado → destino externo criptografado; restore testado com evidência versionada; remover/rewrite stubs.
**Aceite:** `BACKUP-RESTORE-DRILL-RESULT.json` datado com restore real.
**Relatório:** INF-02, DB-07.

### DEBT-0037/0038 — Rollback sem caminho reproduzível; observabilidade cega — P1/P2
INF-03 (tag previous inexistente), INF-04 (Prometheus não scrapea prod, sem Alertmanager, EXPOSE_METRICS off).
**Aceite:** runbook único de rollback + métricas/alertas com receptor real no EC2.

### INF-08/09 — `.env.example` e-mail pessoal + bloco STORAGE duplicado — P3
Remover e-mail real; placeholders `change-me`; deduplicar bloco.

## Observação
Verificar `deploy-ec2.ps1`/`deploy-aws.ps1` (não auditados — podem divergir do .sh).

## Resolução

**Branch:** `agente/10-infra-backup-deploy` | **Worktree:** `C:\Github\Birthub-360-wt\ag-10` | **Commit:** `af70a8787`

### Entregue
- **DEBT-0001**: `deploy-ec2.sh` e `deploy-ec2.ps1` agora executam `docker exec birthhub-app npx prisma migrate deploy` antes do restart e healthcheck fail-closed em `/health/ready` (12 tentativas × 5s, endpoint confirmado em `src/bootstrap/healthchecks.ts:97`). SHA registrado em `deploy-history.log`. `set -euo pipefail` no .sh.
- **DEBT-0002 (parcial)**: `backup-encrypted.sh` reescrito — `pg_dump --format=custom` real + AES-256-CBC/PBKDF2 + manifesto sha256 + retenção configurável; placeholder removido. `restore-test.sh` reescrito — decifra, `pg_restore` em `RESTORE_DATABASE_URL` temporário, sanity check `information_schema`, grava `BACKUP-RESTORE-DRILL-RESULT-<ts>.json` em `audit-evidence/`; **falha fechado (exit 1) sem envs — nunca mais sucesso falso**.
- **DEBT-0037**: `docs/deploy/ROLLBACK-RUNBOOK.md` criado — caminho único de rollback via `dist-backup-*` + `deploy-history.log`.
- **INF-08/09**: `.env.example` — e-mail pessoal substituído por `change-me@example.com`; bloco STORAGE duplicado removido (mantido comentário de fallback MINIO_*).

### Gates executados (evidência real)
- `bash -n` nos 3 scripts: OK
- `backup-encrypted.sh --verify-crypto`: round-trip AES-256 PASS
- `backup-encrypted.sh` sem envs: exit 1 "pg_dump não encontrado" (fail-closed) ✓
- `restore-test.sh` sem arquivo: exit 1 ✓

### Limitações (honestas)
- **Restore real NÃO executado** — exige `BACKUP_ENCRYPTION_KEY` + `RESTORE_DATABASE_URL` de um Postgres temporário (host EC2, depende de D-01). O ensaio agendado (`BACKUP-RESTORE-DRILL-RESULT.json` datado) fica pendente da primeira execução no host.
- `dr-simulation.sh`/`rollback-drill.sh` não foram reescritos (constantes hardcoded) — recomendo deprecar em favor de `restore-test.sh`.
- **DEBT-0038** (Prometheus/Alertmanager/EXPOSE_METRICS em prod) depende de D-01 — documentado no runbook como pendente.
- `deploy-aws.ps1` não auditado (pode divergir) — não verificado.
- Suposição: container `birthhub-app` monta `/home/ubuntu/birthhub-360` (bind mount), caso contrário `docker exec ... prisma migrate deploy` usaria prisma/ antigo — validar no primeiro deploy real.
