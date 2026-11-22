# 10 — CHECKLISTS

## A. Template de checklist por tarefa (usar para cada CENTRAL-XXXX)

### Preparação
- [ ] Escopo confirmado e limitado aos arquivos do handoff
- [ ] Governança consultada (COORDENADOR.md, PENDENTES.md, prompts do agente)
- [ ] Ownership validado (nenhum arquivo de outro agente)
- [ ] Dependências resolvidas (ver 09)
- [ ] Critérios de aceite definidos
- [ ] Branch/worktree isolado planejado

### Implementação
- [ ] Alterações executadas no worktree designado
- [ ] Escopo respeitado (sem arquivos alheios)
- [ ] Evidência de implementação (diff/commits)

### Testes
- [ ] Comandos de gate reais executados (comando + exit code registrados)
- [ ] Testes de domínio aplicáveis
- [ ] `tsc --noEmit` / lint
- [ ] Build quando aplicável

### Revisão
- [ ] Diff revisado
- [ ] Parecer 24 emitido (produto) / revisão documental (plataforma)
- [ ] Problemas obrigatórios corrigidos

### Integração
- [ ] PR preparado / push autorizado
- [ ] Checks aprovados
- [ ] Merge somente com autorização humana
- [ ] Validação pós-merge

### Encerramento
- [ ] `## Resolução` preenchida no handoff (Status + evidências)
- [ ] Documentação/estado atualizados (central-state.json, INDEX)
- [ ] Pendências remanescentes registradas
- [ ] Handoff de encerramento se a sessão terminar

## B. Matriz de prontidão da Central (estado em 22/11)

| Domínio | Critério | Estado | Evidência | Bloqueio | Próxima ação |
|---|---|---|---|---|---|
| Governança | Agentes/regras/permissões definidos | ✅ | COORDENADOR.md, PENDENTES.md, registry.json | — | Manter |
| Handoffs | Integridade/rastreabilidade | ⚠️ | 19 docs íntegros; INDEX desatualizado | CENTRAL-0004 | Atualizar INDEXs |
| Auditoria | Critérios de aceite + pareceres | ⚠️ | Fluxo existe; 4 revisões pendentes | CENTRAL-0022 | Despachar 24 |
| Orquestração | Missões/filas/locks/retentativas | ⚠️ | Implementado e testado; locks expirados não limpos | CENTRAL-0003 | Saneamento |
| Backend | APIs/auth/persistência/erros | ✅ | 89 testes, tsc limpo, auth ok | — | — |
| Frontend | Navegação/dashboard/componentes | ⚠️ | Funcional; swarm aguarda aceite visual; chunk warning | CENTRAL-0011 | Aceite usuário |
| Infra | Config/segurança/monitoramento | ⚠️ | Código pronto; webhook vazio; senha fallback | CENTRAL-0009/0013 | Decisões humanas |
| Qualidade | Testes/CI/build/lint | ✅ | 89 testes, build OK, tsc limpo | — | Manter gate |
| Produto (Birthub) | Release readiness | ❌ | NO-GO; 10 PENDENTE + 4 fantasmas | Onda B | Executar ondas |

Legenda: ✅ pronto · ⚠️ parcial/com ressalva · ❌ bloqueado

## C. Checklist de prontidão operacional (GO/NO-GO do produto)

- [ ] Todos os handoffs da onda em estado terminal com parecer 24
- [ ] P1s bloqueadores fechados: DEBT-0004/0005/0007/0012/0013/0017/0019/0022/0028
- [ ] RLS aplicada (DEBT-0057/0058/DB-08) — migrations + evidência
- [ ] Restore de backup executado de verdade no host
- [ ] Envs de produção verificadas (D-01)
- [ ] Retenção LGPD implementada com janelas ratificadas (D-04)
- [ ] Consentimento IA persistido (AiConsent)
- [ ] assetlinks.json publicado; App Links verificam
- [ ] Waivers Trivy renovados ou SHA candidato cortado
- [ ] Merge order executada; PRs reconciliados
- [ ] Gates de integração verdes
- [ ] Re-veredito emitido
