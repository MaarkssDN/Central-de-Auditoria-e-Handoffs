export interface AgentDirective {
  label: string;
  prompt: string;
}

// Diretivas rápidas por agente — exatamente 2 por agente (ver governanceEngine.test.ts).
export const AGENT_SPECIFIC_DIRECTIVES: Record<string, AgentDirective[]> = {
  '00': [
    { label: 'Reportar estado da onda', prompt: 'Resuma o estado atual da onda ativa: agentes, handoffs abertos e bloqueadores, em 5 linhas.' },
    { label: 'Próxima ação segura', prompt: 'Com base nos bloqueadores e handoffs abertos, qual é a próxima ação segura que não viola a Trava de Mutação?' },
  ],
  '01': [
    { label: 'Auditar schema e RLS', prompt: 'Audite prisma/schema.prisma e as policies RLS: liste riscos de tenancy e migrações pendentes com arquivo:linha.' },
    { label: 'Plano de migração segura', prompt: 'Para a próxima migração necessária, descreva ordem, rollback e evidência de verificação.' },
  ],
  '01A': [
    { label: 'Revisar retenção e purge', prompt: 'Verifique se o serviço de purge de retenção usa contexto de tenant correto e está compatível com RLS.' },
    { label: 'Auditar janelas de retenção', prompt: 'Liste tabelas com dados pessoais e proponha janelas de retenção justificadas por LGPD.' },
  ],
  '02': [
    { label: 'Auditar completude de rotas', prompt: 'Cruze rotas declaradas na navegação com telas reais implementadas e liste rotas mortas.' },
    { label: 'Corrigir navegação quebrada', prompt: 'Encontre fluxos de UI que prometem ação sem implementação (ex.: criar lead) e proponha correção mínima.' },
  ],
  '02A': [
    { label: 'Auditoria heurística de usabilidade', prompt: 'Execute avaliação heurística nas telas críticas e liste os 5 maiores pontos de fricção com severidade e correção objetiva.' },
    { label: 'Roteiro de teste com usuários', prompt: 'Monte um roteiro enxuto de teste de usabilidade com tarefas reais, métricas de conclusão e critérios de aprovação.' },
  ],
  '02B': [
    { label: 'Mapear jornada ponta a ponta', prompt: 'Trace a jornada completa do usuário da entrada à ação principal e destaque becos sem saída, estados vazios e quedas.' },
    { label: 'Corrigir estados de erro no fluxo', prompt: 'Audite transições e estados de erro/carregamento nos fluxos críticos garantindo recuperação clara sem perder contexto.' },
  ],
  '02C': [
    { label: 'Auditar taxonomia e menus', prompt: 'Revise a estrutura de menus, rótulos e profundidade de navegação; elimine ambiguidades e categorias redundantes.' },
    { label: 'Mapa de rotas e hierarquia', prompt: 'Organize a arquitetura de informação das telas principais com agrupamentos claros e critérios objetivos de localização.' },
  ],
  '02D': [
    { label: 'Auditar dobra e conversão', prompt: 'Avalie proposta de valor above-the-fold, hierarquia de CTA, prova real e fricção de formulário na experiência de conversão.' },
    { label: 'Otimizar funil de landing page', prompt: 'Identifique bloqueios de conversão na página de entrada e proponha melhorias cirúrgicas sem promessas ou dados fictícios.' },
  ],
  '03': [
    { label: 'Escanear acessibilidade', prompt: 'Liste componentes interativos sem label, foco visível ou contraste AA no escopo atual.' },
    { label: 'Checklist WCAG do diff', prompt: 'Para as mudanças recentes, verifique teclado, aria e contraste; reporte violações com arquivo:linha.' },
  ],
  '04': [
    { label: 'Auditar integridade do funil', prompt: 'Verifique transições de status do lead: há bypass de stage-history ou updates parciais enganosos?' },
    { label: 'Proveniência dos KPIs', prompt: 'Para cada KPI do dashboard, indique a fonte de dados e se há fallback silencioso.' },
  ],
  '05': [
    { label: 'Auditar guarda SSRF', prompt: 'Verifique isSafeUrl nos scrapers/crawlers: redirects são revalidados? DNS-aware? Liste bypasses.' },
    { label: 'Revisar cadência e opt-out', prompt: 'Verifique detecção de resposta, cutoff temporal e presença de instrução de descadastro nas mensagens.' },
  ],
  '06': [
    { label: 'Auditar atomicidade Bitrix', prompt: 'Verifique import Bitrix: criação de Company/Contact/Lead é atômica? O que acontece em falha parcial?' },
    { label: 'Fallback cross-tenant', prompt: 'Verifique uso de BITRIX24_WEBHOOK_URL global: há risco de contaminação entre tenants?' },
  ],
  '06A': [
    { label: 'Auditar extrações Bitrix', prompt: 'Verifique idempotência e deduplicação nas extrações: reprocessar o mesmo lote duplica dados?' },
    { label: 'Lotes e retry', prompt: 'Mapeie o fluxo de lotes de extração: o que acontece em retry após falha parcial?' },
  ],
  '07': [
    { label: 'Auditar gateway de IA', prompt: 'Verifique se todo cliente LLM passa pelo gateway: quota, budget, circuit breaker e AILog por chamada.' },
    { label: 'Consentimento e quota fail-open', prompt: 'Avalie o modelo de consentimento de IA e os caminhos onde quota pode falhar aberto.' },
  ],
  '08': [
    { label: 'Status dos gates', prompt: 'Liste gates obrigatórios do AGENTS.md e marque quais estão implementados no CI e quais faltam.' },
    { label: 'Cobertura real do Sonar', prompt: 'Verifique se a cobertura reportada inclui testes de integração ou só unitários.' },
  ],
  '08A': [
    { label: 'Checklist de release', prompt: 'Monte o checklist objetivo de GO-LIVE com evidência exigida por item.' },
    { label: 'Plano de rollback', prompt: 'Para o deploy atual, descreva passos de rollback e o que precisa estar verde antes.' },
  ],
  '09': [
    { label: 'Escopo mobile Day-1', prompt: 'Avalie o estado do app Capacitor/Android e liste o que falta para lançamento ou exclusão formal.' },
    { label: 'PWA vs nativo', prompt: 'Compare o que o PWA instalável já cobre versus o que exige build nativo; recomende escopo.' },
  ],
  '10': [
    { label: 'Auditar deploy EC2', prompt: 'Verifique deploy-ec2.sh: migrações, healthcheck pós-deploy e versionamento de imagem existem?' },
    { label: 'Backup e DR reais', prompt: 'Audite scripts de backup/restore: são stubs? Há evidência de execução real e teste de restore?' },
  ],
  '11': [
    { label: 'Auditar identidade visual', prompt: 'Verifique consistência de marca nos assets e telas públicas; liste divergências.' },
    { label: 'Docs institucionais', prompt: 'Revise documentacao-aplicacao/**: há documentação desatualizada ou contraditória?' },
  ],
  '12': [
    { label: 'Consentimento e retenção de voz', prompt: 'Verifique se transcrições, URLs de gravação e payloads de telefonia respeitam consentimento e retenção.' },
    { label: 'Toques pendentes eternos', prompt: 'Audite cadência de voz: o que acontece com touches pending quando o callback do provider se perde?' },
  ],
  '13': [
    { label: 'Auditar loop ReAct', prompt: 'Verifique o loop do enxame: cada iteração passa pelo gateway com quota e AILog, ou há bypass?' },
    { label: 'Fallback de prompt aprovado', prompt: 'Avalie o fallback que fabrica prompts/templates: podem ser persistidos como approved?' },
  ],
  '14': [
    { label: 'Mapa do test harness', prompt: 'Inventarie testes unitários, integração e e2e: o que executa código real e o que é mock?' },
    { label: 'Evidência de persistência', prompt: 'Para fluxos críticos, liste quais testes provam persistência real versus apenas renderização.' },
  ],
  '15': [
    { label: 'Auditar SSRF residual', prompt: 'Verifique isSafeUrl vs guarda canônica DNS-aware em todos os caminhos de scraping/crawling.' },
    { label: 'Segredos compartilhados', prompt: 'Liste segredos globais (ex.: 3CX, Bitrix) que podem vazar entre tenants.' },
  ],
  '16': [
    { label: 'Topologia de workers', prompt: 'Mapeie filas outbound (Bitrix, CRM) até seus consumidores na topologia de deploy atual.' },
    { label: 'Retries e DLQ', prompt: 'Verifique retries, timeouts e dead-letter das filas críticas de produção.' },
  ],
  '17': [
    { label: 'Cutoff de resposta na cadência', prompt: 'Verifique hasLeadReplied: existe corte temporal ou qualquer resposta histórica mata a cadência?' },
    { label: 'Cold email compliance', prompt: 'Audite cold email: persistência, base legal, idempotência e instrução de opt-out.' },
  ],
  '18': [
    { label: 'Drift OpenAPI', prompt: 'Verifique a detecção de drift: paths documentados sem implementação são detectados? E o inverso?' },
    { label: 'Contratos de filas', prompt: 'Liste contratos de mensageria entre produtores e consumidores e seus pontos de falha.' },
  ],
  '21': [
    { label: 'Inventário de tratamento', prompt: 'Liste categorias de dados pessoais persistidas e sua finalidade/base legal declarada.' },
    { label: 'Fluxo DSR', prompt: 'Audite o fluxo de direitos do titular: exportação, exclusão e prazo de resposta.' },
  ],
  '22': [
    { label: 'Verificar persistência real', prompt: 'Escolha 3 ações de UI críticas e verifique se realmente persistem (DB/rede), não só estado local.' },
    { label: 'PII ponta a ponta', prompt: 'Trace um dado pessoal do formulário à persistência: há sanitização, criptografia ou vazamento em logs?' },
  ],
  '23': [
    { label: 'Auditar custos de IA', prompt: 'Estime custo por iteração do enxame e do gateway: há budget, alertas e telemetria de tokens?' },
    { label: 'N+1 e latência', prompt: 'Liste queries e chamadas externas com padrão N+1 ou sem cache nas rotas quentes.' },
  ],
  '24': [
    { label: 'Revisar último handoff', prompt: 'Abra o handoff mais recente AGUARDANDO_24, audite diff e evidências e emita parecer formal.' },
    { label: 'Amostra de achados P0/P1', prompt: 'Sorteie 3 achados do inventário mestre e confirme ou refute com arquivo:linha no código atual.' },
  ],
};

export function getDirectivesForAgent(agentId: string, codename: string, name: string): AgentDirective[] {
  const base = AGENT_SPECIFIC_DIRECTIVES[agentId];
  if (base) return base;
  return [
    { label: `Status de ${codename}`, prompt: `Resuma o estado atual do seu domínio como ${name} (${agentId}) em 5 linhas.` },
    { label: `Riscos de ${codename}`, prompt: `Liste os 3 maiores riscos abertos no domínio do Agente ${agentId} com evidência.` },
  ];
}
