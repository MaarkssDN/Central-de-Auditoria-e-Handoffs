# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\Github\Birthub-360
Worktree de trabalho: C:\Github\Birthub-360-wt\ag-09 | Branch: agente/09-mobile-decisao

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
C:\Github\Central-de-Auditoria-e-Handoffs\central\ondas\release-readiness-2026-11-18\handoffs\00-para-09-mobile-decisao.md

## Conteúdo do handoff
- De: 00
- Para: 00 (coordenação) / 09 (Mobile) / 11 (Marca)
- Status: PENDENTE
- Prioridade: P0-condicional / P1 / P2

## Achados

### DEBT-0004 — Mobile sem backend alcançável — P0 SE mobile é escopo Day-1
`capacitor.config.ts:28-49`: DEFAULT_APP_URL `app.birthhub360.com.br` "ainda não resolve DNS"; AndroidManifest App Link → onrender.com arquivado; sem assetlinks.json; APK só debug manual.
**Decisão humana:** mobile entra no lançamento? Se sim → backend real+TLS+assetlinks. Se não → remover do escopo/marketing formalmente.
Offline sync real e deep link OK (pontos positivos).

### INF-05/06 — Identidade visual divergente — P1/P2
`identidade-visual/` documenta paleta Neon ANTERIOR (#00D4FF/#FF2D9B) vs paleta vigente (Gold/Iris/Orbit); splash Capacitor usa Obsidian #0B132B. Sincronizar tokens com `globals.css`/`brand.ts`.

### DEBT-0025/ARQ — Clusters mortos — decisão remover×reincluir — P1 higiene
`ai-voice/`+`voice/` (~15 arq sob typecheck), `proposals/` (assinatura simulada), `temporal-workers/`+`crawlee/` (não compilam — SDKs ausentes, excluídos do tsconfig), `public/design-lab/` (~100 arq públicos em prod), `agente-codigo-local/` (segundo app no repo), `prospecting/outbound/` SPA, voice-hub frontend.
**Ação 00:** inventário de decisão por cluster → handoffs aos donos; remoção exige teste de não-uso.

### ARQ-07/08/09/10 — P2
4 componentes `// @ts-nocheck` em produção; framer-motion+motion duplicados; ≥15 deps mortas (rodar `npx knip`); 4-5 stacks LLM paralelos.

### ARQ-13 — Exceções hotspot + waivers Trivy vencem 2026-11-30 — P3 urgente
13 exceções + ~30 waivers em bloco; `check:hotspots` pode falhar em massa. Renovar ou modularizar antes do SHA candidato.


## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
