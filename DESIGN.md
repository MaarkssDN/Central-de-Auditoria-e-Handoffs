# DESIGN.md — Central de Auditoria e Handoffs

## Mundos visuais

### App autenticado: "Blueprint de Guerra" (interior)

Metáfora: planta baixa de engenharia/auditoria — o mesmo desenho técnico que um
arquiteto usa para governar uma obra. Uma central de governança multiagente É um
desenho de engenharia: cada handoff é uma peça, cada agente um ofício, cada gate
uma verificação de estrutura.

- **Ground:** azul-petróleo profundo (`ink-950` → `ink-900`), nunca preto puro.
- **Superfícies:** `panel` — vidro escuro azulado com borda `ink-600` a 45% de opacidade, cantos
  com marcação de desenho (`panel-corner`, ticks de mira cyan).
- **Textura assinatura:** `blueprint-grid` — malha de engenharia em duas escalas
  (24px fina + 120px grossa), uso justificado: é literalmente um blueprint.
- **Acento:** signal cyan (`#38BDF8`) para navegação ativa, dados e ações primárias.
- **Estados como instrumentos:** `chip` + `led` — status é luz de painel, não badge.
- **Tipografia:** Space Grotesk (display/títulos), Inter (corpo), JetBrains Mono
  (dados, códigos, rotas, evidências — aqui mono é instrumento de medida, não
  fantasia "tech").
- **Prioridade:** barra lateral de 3px na cor do nível (P0 vermelho → P3 cinza).

## Regras

- Status nunca em texto corrido: sempre `chip` + `led`.
- Números e contagens em `font-mono tabular-nums`.
- Ações destrutivas/irreversíveis: `btn btn-danger`.
- Movimento: `rise-in` escalonado na entrada; `led-pulse` só para veredito NO-GO.
  `prefers-reduced-motion` desliga tudo.
- Telas legadas em classes `slate-*` herdam o mundo via remap em `index.css`
  (camada não-layered que vence utilities). Novos componentes usam tokens
  semânticos (`panel`, `chip`, `btn`, `input`, `led`, cores `ink-*`/`paper-*`/
  `signal-*`).

## Rotas/seções (NavSection)

`central` (CEN) · `bots` (BOT) · `ondas` (OND) · `handoffs` (HND) ·
`auditoria` (AUD) · `agentes` (AGT) · `repositorios` (REP)

Cada seção tem eyebrow `SEC-XX · descrição` + título `font-display`.

### Superfícies públicas: "Set de filmagem" (landing + login)

Metáfora: set de filmagem — a central é a claquete que abre a tomada: cada agente
é um ator do elenco, cada handoff uma cena, o coordenador o diretor de set.
Implementado em `src/film.css` (escopo `.film-root` / `.film-login-wrap`),
componente `src/components/LandingPage.tsx` e login dedicado em
`LoginModal.tsx`. Fluxo: landing (pública) → CTA → login → app.

- **Ground:** carvão quente `#14100d`, nunca preto puro; painéis `#1d1813`.
- **Papel:** pergaminho `#f0e7d3` para superfícies de documento (call sheet,
  claquete) — o mundo tem dois materiais: o set escuro e o papel claro.
- **Acento:** âmbar de luz prática `#e8a33d`; vermelho tally `#d64545` é a
  cor da ação primária ("Cortar — entrar"), usada com parcimônia.
- **Tipografia:** Oswald (display, uppercase, condensada), Courier Prime
  (dados/slates — aqui mono é claquete e roteiro, não fantasia tech),
  Archivo/Plus Jakarta Sans (corpo). Fontes em `index.html`.
- **Assinaturas:** claquete com braço animado (`film-slap`), marquee de
  provider, call sheet em papel com borda tracejada, monitor mock do chat
  do coordenador (prova do mecanismo, não claim).
- **Movimento:** `prefers-reduced-motion` desliga claquete/marquee/LED.
- Login é tela dedicada (não modal): card `film-login-card`, campos
  `film-login-input`, botão tally; link "Voltar ao letreiro" retorna à
  landing.
