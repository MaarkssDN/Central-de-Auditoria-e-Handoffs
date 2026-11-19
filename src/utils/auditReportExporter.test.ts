import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedWorkspace } from '../data/seedWorkspace';
import {
  buildAuditReportFileName,
  buildTechnicalAuditReport,
  generateAuditReportPdfFromJson,
  serializeAuditReportJson,
} from './auditReportExporter';

test('buildTechnicalAuditReport aggregates approved gates, resolved blockers, and audit verdicts', () => {
  const seed = createSeedWorkspace();
  const repo = seed.repositories[0];
  const wave = seed.waves[0];
  const reviews = seed.reviews;

  const report = buildTechnicalAuditReport({ repo, wave, reviews });

  assert.equal(report.repository.fullName, 'birth-hub/birth-hub-360');
  assert.equal(report.wave?.number, 4);
  assert.equal(report.summary.approvedGatesCount, report.approvedGates.length);
  assert.ok(report.approvedGates.length >= 4);
  assert.ok(report.approvedGates.every((g) => g.status === 'EXECUTADO_VERDE'));

  assert.equal(report.summary.resolvedBlockersCount, report.resolvedBlockers.length);
  assert.equal(report.resolvedBlockers.length, 2);
  assert.deepEqual(
    report.resolvedBlockers.map((b) => b.code),
    ['B-01', 'B-02']
  );

  assert.equal(report.auditVerdicts.length, 2);
  assert.equal(report.summary.approvedVerdictsCount, 1);
  assert.equal(report.summary.rejectedOrBlockedVerdictsCount, 1);
});

test('serializeAuditReportJson and generateAuditReportPdfFromJson produce valid JSON and PDF binary output', () => {
  const seed = createSeedWorkspace();
  const report = buildTechnicalAuditReport({
    repo: seed.repositories[0],
    wave: seed.waves[0],
    reviews: seed.reviews,
  });

  const json = serializeAuditReportJson(report);
  const parsed = JSON.parse(json) as typeof report;
  assert.equal(parsed.schemaVersion, '1.0.0');
  assert.equal(parsed.auditVerdicts.length, 2);

  const { doc, filename } = generateAuditReportPdfFromJson(json);
  assert.match(filename, /^relatorio-auditoria-birth-hub-birth-hub-360-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdfOutput = doc.output('datauristring');
  assert.ok(pdfOutput.startsWith('data:application/pdf;'));
  assert.ok(pdfOutput.length > 500);

  const jsonName = buildAuditReportFileName('org/My Repo', 'json');
  assert.match(jsonName, /^relatorio-auditoria-org-my-repo-\d{4}-\d{2}-\d{2}\.json$/);
});
