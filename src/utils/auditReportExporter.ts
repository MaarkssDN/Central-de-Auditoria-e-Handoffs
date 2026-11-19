import { jsPDF } from 'jspdf';
import type {
  IndependentReview,
  RepositoryTarget,
  TechnicalAuditReport,
  Wave,
} from '../types/governance';

export function buildTechnicalAuditReport(params: {
  repo: RepositoryTarget;
  wave?: Wave;
  reviews: IndependentReview[];
}): TechnicalAuditReport {
  const { repo, wave, reviews } = params;

  const allGates = wave?.gates ?? [];
  const approvedGates = allGates
    .filter((g) => g.status === 'EXECUTADO_VERDE')
    .map((g) => ({
      id: g.id,
      scriptKey: g.scriptKey,
      command: g.command,
      tier: g.tier,
      status: g.status,
      lastRunAt: g.lastRunAt,
      notes: g.notes,
    }));

  const resolvedBlockers = repo.blockers
    .filter((b) => b.status === 'validado' || b.status === 'mitigado' || b.status === 'nao_aplicavel')
    .map((b) => ({
      code: b.code,
      title: b.title,
      ownerAgentId: b.ownerAgentId,
      status: b.status,
      evidenceNote: b.evidenceNote,
    }));

  const openBlockersCount = repo.blockers.filter((b) => b.status === 'aberto').length;

  const auditVerdicts = reviews.map((rev) => ({
    id: rev.id,
    waveNumber: rev.waveNumber,
    missionTitle: rev.missionTitle,
    authorAgentId: rev.authorAgentId,
    auditorAgentId: rev.auditorAgentId,
    commitOrHashes: rev.commitOrHashes,
    verdict: rev.verdict,
    scopeSummary: rev.scopeSummary,
    evidence: rev.evidence,
    p1ToP4Compliant: rev.p1ToP4Compliant,
    tenancyLgpdChecked: rev.tenancyLgpdChecked,
    ownershipCompliant: rev.ownershipCompliant,
    commandsExecuted: rev.commandsExecuted,
    findings: rev.findings,
    pendingItems: rev.pendingItems,
    createdAt: rev.createdAt,
  }));

  const approvedVerdictsCount = auditVerdicts.filter((v) => v.verdict === 'APROVADO').length;
  const rejectedOrBlockedVerdictsCount = auditVerdicts.length - approvedVerdictsCount;

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    repository: {
      id: repo.id,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      sourceType: repo.sourceType,
      detectedAgentsMd: repo.detectedAgentsMd,
    },
    wave: wave
      ? {
          number: wave.number,
          name: wave.name,
          state: wave.state,
          integrationBranch: wave.integrationBranch,
          activeAgentIds: wave.activeAgentIds,
        }
      : null,
    summary: {
      approvedGatesCount: approvedGates.length,
      totalGatesCount: allGates.length,
      resolvedBlockersCount: resolvedBlockers.length,
      openBlockersCount,
      totalBlockersCount: repo.blockers.length,
      approvedVerdictsCount,
      rejectedOrBlockedVerdictsCount,
      totalVerdictsCount: auditVerdicts.length,
    },
    approvedGates,
    resolvedBlockers,
    auditVerdicts,
  };
}

export function serializeAuditReportJson(report: TechnicalAuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function buildAuditReportFileName(repoFullName: string, ext: 'json' | 'pdf'): string {
  const safeRepo = repoFullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stamp = new Date().toISOString().slice(0, 10);
  return `relatorio-auditoria-${safeRepo || 'repositorio'}-${stamp}.${ext}`;
}

export function downloadAuditReportJson(report: TechnicalAuditReport): string {
  const filename = buildAuditReportFileName(report.repository.fullName, 'json');
  const jsonText = serializeAuditReportJson(report);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return filename;
}

/**
 * Converte um relatório técnico estruturado em JSON para PDF técnico multipágina.
 */
export function generateAuditReportPdfFromJson(jsonPayload: string): {
  doc: jsPDF;
  filename: string;
} {
  const report = JSON.parse(jsonPayload) as TechnicalAuditReport;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 46;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 48;
    }
  };

  // Header Banner
  doc.setFillColor(10, 14, 28);
  doc.roundedRect(margin, y - 14, contentWidth, 74, 12, 12, 'F');
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, y - 14, contentWidth, 74, 12, 12, 'S');

  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RELATORIO TECNICO DE AUDITORIA MULTIAGENTE (JSON -> PDF)', margin + 16, y + 6);

  doc.setTextColor(245, 248, 255);
  doc.setFontSize(16);
  doc.text(`Repositorio: ${report.repository.fullName}`, margin + 16, y + 28);

  doc.setTextColor(180, 198, 224);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const waveLine = report.wave
    ? `Onda ${report.wave.number} (${report.wave.state}) | Branch: ${report.wave.integrationBranch}`
    : `Branch padrao: ${report.repository.defaultBranch}`;
  doc.text(
    `${waveLine} | Gerado em ${new Date(report.generatedAt).toLocaleString('pt-BR')}`,
    margin + 16,
    y + 46
  );

  y += 84;

  // Summary KPI Grid
  const kpis = [
    {
      label: 'Gates Aprovados',
      value: `${report.summary.approvedGatesCount}/${report.summary.totalGatesCount}`,
      color: [0, 220, 160] as [number, number, number],
    },
    {
      label: 'Blockers Resolvidos',
      value: `${report.summary.resolvedBlockersCount}/${report.summary.totalBlockersCount}`,
      color: [0, 190, 255] as [number, number, number],
    },
    {
      label: 'Pareceres APROVADOS',
      value: `${report.summary.approvedVerdictsCount}`,
      color: [160, 110, 255] as [number, number, number],
    },
    {
      label: 'Reprov. / Bloqueados',
      value: `${report.summary.rejectedOrBlockedVerdictsCount}`,
      color: [255, 55, 95] as [number, number, number],
    },
  ];

  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (boxWidth + boxGap);
    doc.setFillColor(246, 248, 252);
    doc.setDrawColor(215, 224, 238);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, boxWidth, 50, 8, 8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 10, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 85, 110);
    doc.text(kpi.label, x + 10, y + 40);
  });

  y += 72;

  const drawSectionHeading = (title: string, subtitle: string) => {
    ensureSpace(44);
    doc.setFillColor(18, 25, 46);
    doc.roundedRect(margin, y, contentWidth, 26, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 12, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(150, 220, 255);
    doc.text(subtitle, pageWidth - margin - 12, y + 17, { align: 'right' });
    y += 38;
  };

  // Section 1: Approved Gates
  drawSectionHeading(
    '1. Historico de Gates Aprovados (§28 / §29)',
    `${report.approvedGates.length} aprovado(s)`
  );
  if (report.approvedGates.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum gate marcado como EXECUTADO_VERDE nesta onda.', margin + 4, y);
    y += 22;
  } else {
    for (const gate of report.approvedGates) {
      ensureSpace(42);
      doc.setFillColor(240, 253, 248);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, y - 10, contentWidth, 34, 6, 6, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(gate.command, margin + 10, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(5, 150, 105);
      doc.text(`EXECUTADO_VERDE · ${gate.tier.toUpperCase()}`, pageWidth - margin - 10, y + 4, {
        align: 'right',
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const noteText = [
        gate.lastRunAt ? `Executado em ${new Date(gate.lastRunAt).toLocaleString('pt-BR')}` : '',
        gate.notes || '',
      ]
        .filter(Boolean)
        .join(' — ');
      doc.text(noteText || 'Gate validado sem ressalvas.', margin + 10, y + 18);
      y += 42;
    }
  }

  y += 6;

  // Section 2: Resolved Blockers
  drawSectionHeading(
    '2. Historico de Bloqueadores Resolvidos (§22)',
    `${report.resolvedBlockers.length} resolvido(s)`
  );
  if (report.resolvedBlockers.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum bloqueador B-01..B-14 resolvido ou mitigado ate o momento.', margin + 4, y);
    y += 22;
  } else {
    for (const blocker of report.resolvedBlockers) {
      const evidenceLines = doc.splitTextToSize(
        blocker.evidenceNote || 'Sem nota adicional de evidencia registrada.',
        contentWidth - 24
      ) as string[];
      const cardHeight = 28 + evidenceLines.length * 12;
      ensureSpace(cardHeight + 10);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y - 10, contentWidth, cardHeight, 6, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${blocker.code} — ${blocker.title}`, margin + 10, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(2, 132, 199);
      doc.text(
        `${blocker.status.toUpperCase()} · Agente ${blocker.ownerAgentId}`,
        pageWidth - margin - 10,
        y + 4,
        { align: 'right' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(evidenceLines, margin + 10, y + 19);
      y += cardHeight + 8;
    }
  }

  y += 6;

  // Section 3: Audit Verdicts
  drawSectionHeading(
    '3. Vereditos de Auditoria Independente — Agente 24 (§40)',
    `${report.auditVerdicts.length} parecer(es)`
  );
  if (report.auditVerdicts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum parecer emitido pelo Agente 24 neste repositorio.', margin + 4, y);
    y += 22;
  } else {
    for (const verdict of report.auditVerdicts) {
      const evidenceLines = doc.splitTextToSize(
        `Evidencia: ${verdict.evidence}`,
        contentWidth - 24
      ) as string[];
      const findingsText =
        verdict.findings.length > 0 ? `Achados: ${verdict.findings.join(' | ')}` : '';
      const findingLines = findingsText
        ? (doc.splitTextToSize(findingsText, contentWidth - 24) as string[])
        : [];
      const cardHeight = 46 + evidenceLines.length * 11 + findingLines.length * 11;
      ensureSpace(cardHeight + 12);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(
        verdict.verdict === 'APROVADO' ? 16 : 239,
        verdict.verdict === 'APROVADO' ? 185 : 68,
        verdict.verdict === 'APROVADO' ? 129 : 68
      );
      doc.setLineWidth(1);
      doc.roundedRect(margin, y - 10, contentWidth, cardHeight, 8, 8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(verdict.missionTitle, margin + 10, y + 5);

      doc.setFontSize(8.5);
      doc.setTextColor(
        verdict.verdict === 'APROVADO' ? 5 : 220,
        verdict.verdict === 'APROVADO' ? 150 : 38,
        verdict.verdict === 'APROVADO' ? 105 : 38
      );
      doc.text(verdict.verdict, pageWidth - margin - 10, y + 5, { align: 'right' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Onda ${verdict.waveNumber} | Autor: Ag.${verdict.authorAgentId} | Auditor: Ag.${verdict.auditorAgentId} | Hash: ${verdict.commitOrHashes}`,
        margin + 10,
        y + 19
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(evidenceLines, margin + 10, y + 33);

      if (findingLines.length > 0) {
        doc.setTextColor(185, 28, 28);
        doc.text(findingLines, margin + 10, y + 35 + evidenceLines.length * 11);
      }

      y += cardHeight + 10;
    }
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Central de Auditoria e Handoffs · ${report.repository.fullName} · Schema JSON v${report.schemaVersion}`,
      margin,
      pageHeight - 24
    );
    doc.text(`Pagina ${p} de ${pageCount}`, pageWidth - margin, pageHeight - 24, {
      align: 'right',
    });
  }

  const filename = buildAuditReportFileName(report.repository.fullName, 'pdf');
  return { doc, filename };
}

export function exportAuditReportPdf(report: TechnicalAuditReport): string {
  const jsonPayload = serializeAuditReportJson(report);
  const { doc, filename } = generateAuditReportPdfFromJson(jsonPayload);
  doc.save(filename);
  return filename;
}
