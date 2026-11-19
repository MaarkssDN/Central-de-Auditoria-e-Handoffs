# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\Github\Birthub-360
Worktree de trabalho: C:\Github\Birthub-360-wt\ag-10 | Branch: agente/10-infra-backup-deploy

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
C:\Github\Central-de-Auditoria-e-Handoffs\central\ondas\release-readiness-2026-11-18\handoffs\00-para-10-infra-backup-deploy.md

## Conteúdo do handoff
- De: 00 (Coordenador)
- Para: 10 (Infra/SRE) + 08 (QA)
- Status: PENDENTE
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


## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
