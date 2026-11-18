import type { AgentDefinition } from '../types/governance';

interface AgentAvatarProps {
  agent: AgentDefinition;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function renderCharacterFeatures(agentId: string) {
  // Subtle lighter visor/highlight colors for contrast inside dark helm/faceplate
  switch (agentId) {
    case '00': // Atlas — Comandante de Voo: orbital commander helm + gold compass visor
      return (
        <>
          <path d="M14 5L20 2L26 5" stroke="#F8FAFC" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <rect x="9" y="10" width="22" height="17" rx="5" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.4" />
          <path d="M12 17H28" stroke="#38BDF8" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="20" cy="17" r="2.2" fill="#FBBF24" />
          <path d="M8 29C8 26 13 24 20 24C27 24 32 26 32 29V36H8V29Z" fill="#1E293B" />
          <path d="M15 30L20 33L25 30" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </>
      );
    case '01': // Valkiria — Arquiteta de Fundações: winged shield crest
      return (
        <>
          <path d="M7 13L12 7L14 13M33 13L28 7L26 13" stroke="#E0F2FE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M11 11H29V21C29 25 25 28 20 29C15 28 11 25 11 21V11Z" fill="#0F172A" stroke="#93C5FD" strokeWidth="1.4" />
          <path d="M14 17H18M22 17H26" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 31C11 28 15 27 20 27C25 27 29 28 30 31V36H10V31Z" fill="#1E3A8A" />
        </>
      );
    case '01A': // Sentinela — Guardião RLS: dual-lens hood & lock crest
      return (
        <>
          <path d="M10 15C10 9 14 6 20 6C26 6 30 9 30 15V26H10V15Z" fill="#0F172A" stroke="#7DD3FC" strokeWidth="1.4" />
          <circle cx="15.5" cy="17" r="2.4" fill="#38BDF8" />
          <circle cx="24.5" cy="17" r="2.4" fill="#38BDF8" />
          <rect x="17" y="21.5" width="6" height="3" rx="1" fill="#BAE6FD" />
          <path d="M9 28H31V36H9V28Z" fill="#075985" />
        </>
      );
    case '02': // Lumen — Designer de Fluxos: sleek prism optic
      return (
        <>
          <circle cx="20" cy="6" r="2" fill="#5EEAD4" />
          <line x1="20" y1="8" x2="20" y2="11" stroke="#99F6E4" strokeWidth="1.5" />
          <rect x="10" y="11" width="20" height="15" rx="6" fill="#0F172A" stroke="#5EEAD4" strokeWidth="1.4" />
          <path d="M14 18C15.5 16.5 17.5 16.5 18.5 18M21.5 18C22.5 16.5 24.5 16.5 26 18" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M11 28C12 26 16 25 20 25C24 25 28 26 29 28V36H11V28Z" fill="#115E59" />
        </>
      );
    case '03': // Prisma — Artesã de Contraste: asymmetrical chromatic lens
      return (
        <>
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#DDD6FE" strokeWidth="1.4" />
          <circle cx="15.5" cy="17.5" r="3" fill="#C084FC" />
          <rect x="22" y="15.5" width="5" height="4" rx="1.5" fill="#F472B6" />
          <path d="M16 22.5H24" stroke="#E9D5FF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 28C12 26 28 26 30 28V36H10V28Z" fill="#4C1D95" />
        </>
      );
    case '04': // Oráculo — Analista de Proveniência: geometric data monocle & crown
      return (
        <>
          <path d="M13 9L16 5L20 8L24 5L27 9" stroke="#FDE68A" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <rect x="10" y="10" width="20" height="16" rx="4" fill="#0F172A" stroke="#FBBF24" strokeWidth="1.4" />
          <circle cx="16" cy="17" r="2.8" stroke="#FBBF24" strokeWidth="1.8" fill="none" />
          <circle cx="16" cy="17" r="1" fill="#FEF08A" />
          <line x1="22" y1="17" x2="26" y2="17" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 28H31V36H9V28Z" fill="#78350F" />
        </>
      );
    case '05': // Radar — Batedor de Sinais: sweeping dish antenna
      return (
        <>
          <path d="M24 5C27 5 29 7 29 10" stroke="#FED7AA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <line x1="20" y1="7" x2="20" y2="11" stroke="#FDBA74" strokeWidth="1.8" />
          <rect x="10" y="11" width="20" height="15" rx="5" fill="#0F172A" stroke="#FB923C" strokeWidth="1.4" />
          <circle cx="20" cy="18" r="4" stroke="#F97316" strokeWidth="1.6" fill="none" />
          <circle cx="20" cy="18" r="1.4" fill="#FED7AA" />
          <path d="M10 28C12 26 28 26 30 28V36H10V28Z" fill="#9A3412" />
        </>
      );
    case '06': // Ponte — Engenheiro de Conectores: dual bridge ports & anchor visor
      return (
        <>
          <rect x="6" y="14" width="4" height="6" rx="1.5" fill="#BAE6FD" />
          <rect x="30" y="14" width="4" height="6" rx="1.5" fill="#BAE6FD" />
          <rect x="10" y="10" width="20" height="16" rx="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.4" />
          <path d="M14 17H26M20 14V21" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 28H31V36H9V28Z" fill="#0369A1" />
        </>
      );
    case '06A': // Garimpo — Extrator Determinístico: headlamp miner helm
      return (
        <>
          <path d="M10 14C10 9 14 7 20 7C26 7 30 9 30 14H10Z" fill="#164E63" stroke="#67E8F9" strokeWidth="1.2" />
          <circle cx="20" cy="10.5" r="2.6" fill="#FEF08A" />
          <rect x="11" y="14" width="18" height="12" rx="3" fill="#0F172A" stroke="#22D3EE" strokeWidth="1.3" />
          <line x1="14" y1="19" x2="18" y2="19" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="19" x2="26" y2="19" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 28H30V36H10V28Z" fill="#155E75" />
        </>
      );
    case '07': // Faísca — Orquestrador de Ferramentas: twin bolt antennae
      return (
        <>
          <path d="M13 5L15 10M27 5L25 10" stroke="#DDD6FE" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#A78BFA" strokeWidth="1.4" />
          <path d="M21 13L17 18.5H20.5L19 23L23 17.5H19.5L21 13Z" fill="#C4B5FD" />
          <path d="M10 28C12 26 28 26 30 28V36H10V28Z" fill="#5B21B6" />
        </>
      );
    case '08': // Bastião — Porteiro da Integração: heavy armored gate helm
      return (
        <>
          <rect x="9" y="9" width="22" height="17" rx="3" fill="#0F172A" stroke="#4ADE80" strokeWidth="1.4" />
          <path d="M13 15H27" stroke="#22C55E" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="15" y1="20" x2="15" y2="23" stroke="#86EFAC" strokeWidth="1.5" />
          <line x1="20" y1="20" x2="20" y2="23" stroke="#86EFAC" strokeWidth="1.5" />
          <line x1="25" y1="20" x2="25" y2="23" stroke="#86EFAC" strokeWidth="1.5" />
          <path d="M8 28H32V36H8V28Z" fill="#166534" />
        </>
      );
    case '08A': // Despachante — Piloto de Release: flight helmet & wing fins
      return (
        <>
          <path d="M8 17L5 13M32 17L35 13" stroke="#BBF7D0" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="10" y="10" width="20" height="16" rx="7" fill="#0F172A" stroke="#34D399" strokeWidth="1.4" />
          <path d="M13 16C15 14.5 25 14.5 27 16L25 20H15L13 16Z" fill="#10B981" />
          <path d="M10 28C13 26 27 26 30 28V36H10V28Z" fill="#14532D" />
        </>
      );
    case '09': // Nômade — Engenheiro Mobile: tall tactical comm antenna
      return (
        <>
          <line x1="26" y1="4" x2="26" y2="11" stroke="#C7D2FE" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="26" cy="4" r="1.4" fill="#A5B4FC" />
          <rect x="11" y="10" width="18" height="16" rx="4" fill="#0F172A" stroke="#818CF8" strokeWidth="1.4" />
          <rect x="14" y="14" width="12" height="5" rx="2" fill="#6366F1" />
          <circle cx="20" cy="22.5" r="1.2" fill="#C7D2FE" />
          <path d="M10 28H30V36H10V28Z" fill="#312E81" />
        </>
      );
    case '10': // Titã — Guardião SRE: wide industrial collar & telemetry bar
      return (
        <>
          <rect x="8" y="9" width="24" height="17" rx="3" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
          <path d="M12 16H17L19 13L21 19L23 16H28" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M7 28H33V36H7V28Z" fill="#1E293B" />
        </>
      );
    case '11': // Selo — Curador de Identidade: crown seal & precision visor
      return (
        <>
          <circle cx="20" cy="7" r="2.2" fill="#FBCFE8" />
          <rect x="10" y="10" width="20" height="16" rx="6" fill="#0F172A" stroke="#F472B6" strokeWidth="1.4" />
          <circle cx="15.5" cy="17" r="2" fill="#F472B6" />
          <circle cx="24.5" cy="17" r="2" fill="#F472B6" />
          <path d="M16 22C18 23.5 22 23.5 24 22" stroke="#FBCFE8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M10 28H30V36H10V28Z" fill="#831843" />
        </>
      );
    case '12': // Eco — Especialista em Voz: studio headset & wave visor
      return (
        <>
          <path d="M8 18V15C8 9 13 6 20 6C27 6 32 9 32 15V18" stroke="#99F6E4" strokeWidth="1.8" fill="none" />
          <rect x="6" y="15" width="4" height="7" rx="1.5" fill="#2DD4BF" />
          <rect x="30" y="15" width="4" height="7" rx="1.5" fill="#2DD4BF" />
          <rect x="11" y="11" width="18" height="15" rx="5" fill="#0F172A" stroke="#2DD4BF" strokeWidth="1.2" />
          <path d="M14 18.5H16.5L18 15L20 22L22 16.5L23.5 18.5H26" stroke="#5EEAD4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M10 28H30V36H10V28Z" fill="#115E59" />
        </>
      );
    case '13': // Enxame — Supervisor Runtime: hex-core tri-optic
      return (
        <>
          <polygon points="20,6 29,11 29,22 20,27 11,22 11,11" fill="#0F172A" stroke="#818CF8" strokeWidth="1.4" />
          <circle cx="20" cy="14" r="1.8" fill="#A5B4FC" />
          <circle cx="16" cy="19.5" r="1.8" fill="#6366F1" />
          <circle cx="24" cy="19.5" r="1.8" fill="#6366F1" />
          <path d="M10 28H30V36H10V28Z" fill="#3730A3" />
        </>
      );
    case '14': // Forja — Ferreiro de Testes: heavy welding mask
      return (
        <>
          <rect x="9" y="9" width="22" height="18" rx="4" fill="#0F172A" stroke="#CBD5E1" strokeWidth="1.4" />
          <rect x="12" y="13" width="16" height="5" rx="1.5" fill="#F59E0B" />
          <path d="M15 22H25" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 29H32V36H8V29Z" fill="#334155" />
        </>
      );
    case '15': // Cofre — Caçador de Segredos: vault door visor + crimson laser eye
      return (
        <>
          <rect x="9" y="9" width="22" height="17" rx="4" fill="#0F172A" stroke="#FCA5A5" strokeWidth="1.4" />
          <circle cx="20" cy="17" r="4.8" stroke="#EF4444" strokeWidth="1.8" fill="#1E293B" />
          <circle cx="20" cy="17" r="1.8" fill="#F87171" />
          <line x1="12" y1="17" x2="15" y2="17" stroke="#FCA5A5" strokeWidth="1.4" />
          <line x1="25" y1="17" x2="28" y2="17" stroke="#FCA5A5" strokeWidth="1.4" />
          <path d="M9 28H31V36H9V28Z" fill="#7F1D1D" />
        </>
      );
    case '16': // Turbina — Engenheiro de Filas: twin intake vents & speed visor
      return (
        <>
          <path d="M11 8L14 11M29 8L26 11" stroke="#FDBA74" strokeWidth="2" strokeLinecap="round" />
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#FB923C" strokeWidth="1.4" />
          <path d="M13 15L27 18L13 21" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M9 28H31V36H9V28Z" fill="#9A3412" />
        </>
      );
    case '17': // Cadência — Maestro Receita: equalizer bars visor
      return (
        <>
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#D8B4FE" strokeWidth="1.4" />
          <line x1="14" y1="19" x2="14" y2="15" stroke="#E879F9" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="21" x2="18" y2="14" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="19" x2="22" y2="15" stroke="#E879F9" strokeWidth="2" strokeLinecap="round" />
          <line x1="26" y1="20" x2="26" y2="16" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 28H30V36H10V28Z" fill="#581C87" />
        </>
      );
    case '18': // Escrivão — Notário de Contratos: dual specs + crest
      return (
        <>
          <rect x="10" y="10" width="20" height="16" rx="4" fill="#0F172A" stroke="#93C5FD" strokeWidth="1.4" />
          <rect x="13" y="15" width="5.5" height="4" rx="1" stroke="#60A5FA" strokeWidth="1.6" fill="none" />
          <rect x="21.5" y="15" width="5.5" height="4" rx="1" stroke="#60A5FA" strokeWidth="1.6" fill="none" />
          <line x1="18.5" y1="17" x2="21.5" y2="17" stroke="#93C5FD" strokeWidth="1.4" />
          <path d="M16 22.5H24" stroke="#BFDBFE" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M10 28H30V36H10V28Z" fill="#1E40AF" />
        </>
      );
    case '21': // Escudo — Encarregado LGPD: privacy cowl & lock emblem
      return (
        <>
          <path d="M10 14C10 8.5 14 6 20 6C26 6 30 8.5 30 14V25H10V14Z" fill="#0F172A" stroke="#6EE7B7" strokeWidth="1.4" />
          <path d="M13 17H27" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="20" cy="21.5" r="1.6" fill="#A7F3D0" />
          <path d="M9 28H31V36H9V28Z" fill="#065F46" />
        </>
      );
    case '22': // Lupa — Inspetora Ponta a Ponta: asymmetric magnifier lens
      return (
        <>
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#FCD34D" strokeWidth="1.4" />
          <circle cx="16.5" cy="17" r="3.6" stroke="#FBBF24" strokeWidth="1.8" fill="#1E293B" />
          <circle cx="16.5" cy="17" r="1.2" fill="#FEF08A" />
          <circle cx="24.5" cy="17" r="1.8" fill="#F59E0B" />
          <path d="M10 28H30V36H10V28Z" fill="#92400E" />
        </>
      );
    case '23': // Balança — Auditora de Eficiência: twin dial eyes
      return (
        <>
          <rect x="10" y="10" width="20" height="16" rx="5" fill="#0F172A" stroke="#67E8F9" strokeWidth="1.4" />
          <circle cx="15.5" cy="17" r="2.6" stroke="#22D3EE" strokeWidth="1.5" fill="none" />
          <line x1="15.5" y1="17" x2="17" y2="15.5" stroke="#CFFAFE" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="24.5" cy="17" r="2.6" stroke="#22D3EE" strokeWidth="1.5" fill="none" />
          <line x1="24.5" y1="17" x2="26" y2="15.5" stroke="#CFFAFE" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M10 28H30V36H10V28Z" fill="#155E75" />
        </>
      );
    case '24': // Veredito — Juiz Independente: crimson judicial mask & scales crest
    default:
      return (
        <>
          <path d="M14 7H26M20 4V9" stroke="#FECACA" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 10H31V21C31 24.5 26 27.5 20 28.5C14 27.5 9 24.5 9 21V10Z" fill="#0F172A" stroke="#F87171" strokeWidth="1.5" />
          <path d="M13 16.5L18 17.5M27 16.5L22 17.5" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M16 22.5H24" stroke="#FCA5A5" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M8 29H32V36H8V29Z" fill="#7F1D1D" />
        </>
      );
  }
}

export function AgentAvatar({ agent, size = 'md' }: AgentAvatarProps) {
  const dimensions =
    size === 'xl'
      ? 'w-16 h-16 rounded-xl'
      : size === 'lg'
        ? 'w-12 h-12 rounded-lg'
        : size === 'sm'
          ? 'w-8 h-8 rounded-md'
          : 'w-10 h-10 rounded-lg';

  return (
    <div
      className={`${dimensions} shrink-0 overflow-hidden border border-black/10 flex items-center justify-center`}
      style={{
        background: `linear-gradient(135deg, ${agent.persona.accentHex} 0%, #0F172A 100%)`,
      }}
      title={`${agent.id} · ${agent.persona.codename} — ${agent.persona.archetype}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <rect x="0" y="0" width="40" height="40" fill="none" />
        {renderCharacterFeatures(agent.id)}
      </svg>
    </div>
  );
}
