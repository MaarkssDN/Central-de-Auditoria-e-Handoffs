# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desenvolvedor solo (o próprio dono do produto) que opera vários repositórios e quer comandar agentes de IA (Codex, Claude, ChatGPT, Gemini, Antigravity, Devin, Copilot, Grok) a partir de uma central local. Uso em máquina própria, pt-BR.

## Product Purpose

Central de Auditoria e Handoffs: console local de governança multiagente. Recebe missões, distribui handoffs entre agentes, audita execuções (Parecer 24), gerencia ondas/repositórios e conecta providers de IA. Sucesso = o dono consegue orquestrar, auditar e executar trabalho de agentes nos seus repos sem sair do app.

## Positioning

Não é mais um chat com IA: é uma central de governança que audita, delega e verifica o trabalho de vários agentes de IA em repositórios reais — mecanismo que um wrapper de chat não copia (handoffs, locks, worktrees, parecer independente, trilha de auditoria).

## Operating Context

App local (localhost), login único, tema claro/escuro, seções: Chat Boot (coordenador), Conexões de IA, Arquivos Locais, Personagens e Bots, Ondas e Missões, Central de Handoffs, Auditoria e Parecer 24, Agentes e Propriedade, Repositórios, Central Local. Dados em SQLite local (`data/central.db`), estado em `central/` (handoffs .md, ondas, decisões).

## Capabilities and Constraints

- Providers: CLI detectadas (codex, claude, copilot) e APIs com chave (OpenAI, Gemini, xAI, Devin); Antigravity/manual gera pacote de prompt.
- FS sandboxed: leitura/edição local limitada a raízes registradas, com auditoria.
- Coordenador: dispatch por prioridade/dependências/locks, git worktrees, fila de prompts.
- Restrições: app local single-user; sem claims comerciais inventáveis (preço, clientes, benchmarks).

## Brand Commitments

Nome: "Central de Auditoria e Handoffs" / "Governança 360". Idioma: pt-BR. Tom: direto, técnico, de quem constrói.

## Evidence on Hand

Funcionalidade real e testada (58+ testes, typecheck limpo). Sem depoimentos, clientes ou métricas — a landing page não pode inventá-los; demonstra o produto em uso.

## Product Principles

1. Demonstrar o mecanismo, não descrever features.
2. Conteúdo autoral em fidelidade total, rotulado como demonstração quando aplicável.
3. Clareza primeiro: o visitante entende em segundos o que a central faz.
