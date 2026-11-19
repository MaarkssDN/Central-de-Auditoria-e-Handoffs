import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWebhookPayload, validateWebhookConfig } from './webhookNotifier';

test('validateWebhookConfig accepts valid Slack and Discord HTTPS URLs and blocks SSRF/invalid URLs', () => {
  const okSlack = validateWebhookConfig('slack', 'https://hooks.slack.com/services/T000/B000/XXXX');
  assert.equal(okSlack.valid, true);

  const okDiscord = validateWebhookConfig('discord', 'https://discord.com/api/webhooks/123456/abcdef');
  assert.equal(okDiscord.valid, true);

  const badHttp = validateWebhookConfig('slack', 'http://hooks.slack.com/services/T000/B000/XXXX');
  assert.equal(badHttp.valid, false);
  assert.match(badHttp.error || '', /HTTPS/i);

  const ssrfAttempt = validateWebhookConfig('discord', 'https://169.254.169.254/latest/meta-data');
  assert.equal(ssrfAttempt.valid, false);

  const providerMismatch = validateWebhookConfig(
    'slack',
    'https://discord.com/api/webhooks/123456/abcdef'
  );
  assert.equal(providerMismatch.valid, false);
});

test('buildWebhookPayload constructs valid Slack and Discord payloads for handoff and audit failure events', () => {
  const slackPayload = buildWebhookPayload({
    provider: 'slack',
    url: 'https://hooks.slack.com/services/T000/B000/XXXX',
    eventType: 'handoff_created',
    repoFullName: 'birth-hub/birth-hub-360',
    title: 'Handoff 06 -> 01 (tenant-bitrix-sync-log)',
    details: 'Prioridade bloqueador em prisma/schema.prisma',
    severity: 'warning',
    channelLabel: '#governanca',
  });
  assert.match(String(slackPayload.text), /NOVO HANDOFF/);
  assert.ok(Array.isArray(slackPayload.attachments));

  const discordPayload = buildWebhookPayload({
    provider: 'discord',
    url: 'https://discord.com/api/webhooks/123456/abcdef',
    eventType: 'audit_failure',
    repoFullName: 'birth-hub/birth-hub-360',
    title: 'Parecer REPROVADO emitido pelo Agente 24',
    details: 'Falta teste de acesso cruzado entre tenants.',
    severity: 'critical',
  });
  assert.match(String(discordPayload.content), /FALHA DE AUDITORIA/);
  assert.ok(Array.isArray(discordPayload.embeds));
  const firstEmbed = (discordPayload.embeds as Array<{ color: number }>)[0];
  assert.equal(firstEmbed.color, 0xff073a);
});
