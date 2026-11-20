- De: 00
- Para: 00 (coordenação) / 09 (Mobile) / 11 (Marca)
- Status: AGUARDANDO_24
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

## Resolução

**Branch:** `agente/09-mobile-decisao` | **Worktree:** `C:\Github\Birthub-360-wt\ag-09` | **Commit:** `f797f15b7`

### Entregue (parte mobile)
- **DEBT-0004 (parcial)**: `AndroidManifest.xml` — App Link `autoVerify` agora aponta para `app.birthhub360.com.br` (domínio canônico, mesmo `DEFAULT_APP_URL` do capacitor.config.ts). Host `birthhub-360.onrender.com` removido (Render desativado). Sem DNS/assetlinks, o link funciona como deep link comum; verificação automática depende de infra (D-01).

### Verificado sem alteração necessária
- Splash `#0B132B` (Obsidian) é consistente: o mesmo hex é usado em `src/features/auth`, `landing`, `prospecting/outbound` — não é divergência, é a cor de marca dark estabelecida. Alinhar para `#0D0D0D` (token `--neon-black`) seria mudança de marca, não de mobile → decisão do 11.
- `capacitor.config.ts` já exige `CAPACITOR_SERVER_URL` em build CI de produção (fail-fast) — correto.

### Pendências fora do escopo do 09 (registradas para o 00)
- **DNS + TLS + `/.well-known/assetlinks.json`** no domínio → Agente 10/08 (depende de D-01).
- **INF-05/06** (identidade visual Neon×Gold/Iris/Orbit): dono é o 11 — `identidade-visual/` precisa ser reconciliado com `brand.ts`/`globals.css` (que seguem Neon como canônico). Handoff sugerido 09→11.
- **DEBT-0025**: D-06 resolvida ("todos liberados") → clusters devem ser REINTEGRADOS, não removidos. Requer handoffs por cluster aos donos (ai-voice/voice→12, proposals→?, design-lab→03, temporal-workers/crawlee→01/16, agente-codigo-local→00, outbound SPA→05).
- **ARQ-07/08/09/10** (P2) e **ARQ-13** (P3, waivers Trivy vencem 2026-11-30): não executados — recomendo handoffs dedicados; ARQ-13 é urgente se o SHA candidato for cortado antes de 30/11.
