# Central de Auditoria — Birth Hub 360°

Sistema externo de auditoria e handoffs orquestrado por um agente coordenador. **Fica fora do repositório** — não é versionado, não interfere no git do produto.

## Estrutura

```
Central-Auditoria-BirthHub/
├── README.md                  ← este arquivo
├── COORDENADOR.md             ← instruções do agente coordenador (o que você aciona)
├── TEMPLATE-HANDOFF.md        ← modelo para handoffs de futuras ondas
├── estado/
│   └── central-state.json     ← checkpoint global (onda ativa, lotes, bloqueios)
├── decisoes/
│   └── PENDENTES.md           ← decisões que só o humano pode tomar
└── ondas/
    ├── INDEX.md               ← índice de todas as ondas
    └── <nome-da-onda>/
        ├── auditoria/         ← relatórios de domínio, inventário, pareceres
        ├── handoffs/          ← 1 arquivo por tarefa + INDEX.md da onda
        └── revisoes/          ← pareceres do Agente 24 por entrega
```

## Ciclo de vida de um handoff

```
PENDENTE → EM_EXECUÇÃO → AGUARDANDO_24 → CONCLUÍDO
                ↑              ↓
                └── REPROVADO_24 (volta p/ correção, motivo no arquivo)
                └── BLOQUEADO (dependência ou decisão humana)
```

- O executor muda `Status:` no próprio arquivo do handoff e preenche `## Resolução`.
- O coordenador só marca `CONCLUÍDO` após parecer 24 favorável registrado em `revisoes/`.
- Nada é considerado feito porque "o PR existe" — só com evidência de gates + revisão.

## Como acionar

1. Abra uma sessão Devin (no repo ou na pasta do worktree do agente).
2. Diga: **"Execute o coordenador da Central-Auditoria-BirthHub"** (ou aponte para `COORDENADOR.md`).
3. O coordenador lê `estado/central-state.json` + `ondas/INDEX.md`, verifica dependências, dispara os agentes em lotes, acompanha status e atualiza o checkpoint.

## Regras herdadas do projeto

- Propriedade de arquivos e slots exclusivos (01/01A, 06/06A, 08/08A) continuam valendo — estão nos prompts dos agentes.
- `server.ts`, `package.json`, lockfiles e `prisma/schema.prisma` exigem aprovação do coordenador/dono.
- Agente 24 revisa cada entrega na revisão exata antes de merge.
- Worktree isolado por executor; nunca dois agentes no mesmo checkout.
- Gates executados de verdade ou registrados como NÃO EXECUTADOS — nunca verde por omissão.
