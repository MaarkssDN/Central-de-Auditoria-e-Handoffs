# DESIGN.md — Central de Auditoria e Handoffs

## Mundo visual: "Blueprint de Guerra"

Metáfora: planta baixa de engenharia/auditoria — o mesmo desenho técnico que um
arquiteto usa para governar uma obra. Uma central de governança multiagente É um
desenho de engenharia: cada handoff é uma peça, cada agente um ofício, cada gate
uma verificação de estrutura.

- **Ground:** azul-petróleo profundo (`ink-950` → `ink-900`), nunca preto puro.
- **Superfícies:** `panel` — vidro escuro azulado com borda `ink-600/45`, cantos
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
