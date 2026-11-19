import type { WebhookProvider } from '../types/governance';

export type WebhookEventType = 'test' | 'handoff_created' | 'audit_failure';

export interface WebhookDispatchInput {
  provider: WebhookProvider;
  url: string;
  eventType: WebhookEventType;
  repoFullName: string;
  title: string;
  details: string;
  severity?: 'info' | 'warning' | 'critical';
  channelLabel?: string;
}

export function validateWebhookConfig(
  provider: WebhookProvider,
  rawUrl: string
): { valid: boolean; error?: string; normalizedUrl?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Informe a URL do Webhook antes de salvar ou testar.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'URL inválida. Use um endereço HTTPS válido do Slack ou Discord.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Por segurança (§24), apenas webhooks HTTPS são permitidos.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (provider === 'slack') {
    if (host !== 'hooks.slack.com' || !parsed.pathname.startsWith('/services/')) {
      return {
        valid: false,
        error: 'Webhook Slack inválido. Esperado formato https://hooks.slack.com/services/...',
      };
    }
  } else {
    const isDiscordHost = host === 'discord.com' || host === 'discordapp.com';
    if (!isDiscordHost || !parsed.pathname.startsWith('/api/webhooks/')) {
      return {
        valid: false,
        error: 'Webhook Discord inválido. Esperado formato https://discord.com/api/webhooks/...',
      };
    }
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

export function buildWebhookPayload(input: WebhookDispatchInput): Record<string, unknown> {
  const { provider, eventType, repoFullName, title, details, severity = 'info', channelLabel } = input;
  const eventTag =
    eventType === 'handoff_created'
      ? 'NOVO HANDOFF (§18)'
      : eventType === 'audit_failure'
        ? 'FALHA DE AUDITORIA (§40)'
        : 'TESTE DE INTEGRACAO';

  const timestamp = new Date().toISOString();

  if (provider === 'slack') {
    const color =
      severity === 'critical' ? '#FF073A' : severity === 'warning' ? '#FFB800' : '#00F0FF';
    return {
      text: `[${eventTag}] ${repoFullName} — ${title}`,
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${eventTag} · ${repoFullName}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${title}*\n${details}`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Central de Auditoria e Handoffs${channelLabel ? ` · Canal: ${channelLabel}` : ''} · ${timestamp}`,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Discord Embed payload with vivid neon decimal colors
  const discordColor =
    severity === 'critical' ? 0xff073a : severity === 'warning' ? 0xffb800 : 0x00f0ff;

  return {
    username: 'Governança 360 · Central de Auditoria',
    content: `**[${eventTag}]** \`${repoFullName}\``,
    embeds: [
      {
        title,
        description: details,
        color: discordColor,
        fields: [
          { name: 'Repositório', value: repoFullName, inline: true },
          { name: 'Evento', value: eventTag, inline: true },
          ...(channelLabel ? [{ name: 'Canal', value: channelLabel, inline: true }] : []),
        ],
        footer: { text: 'Central de Auditoria e Handoffs · AGENTS.md' },
        timestamp,
      },
    ],
  };
}
