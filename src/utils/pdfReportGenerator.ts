import { jsPDF } from 'jspdf';
import type { StoichiometryResult } from './chemistryEngine';

export interface ExperimentReportPayload {
  title: string;
  reactantAName: string;
  reactantAFormula: string;
  reactantAMassG: number;
  reactantBName: string;
  reactantBFormula: string;
  reactantBMassG: number;
  balancedEquation: string;
  didReact: boolean;
  reactionType: string;
  colorBefore: string;
  colorAfter: string;
  stateChange: string;
  thermalNote: string;
  observationDetail: string;
  stoichiometry: StoichiometryResult;
  createdAtText?: string;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function exportExperimentPdfReport(payload: ExperimentReportPayload): string {
  // Render high-DPI A4 canvas (1240 x 1754 px = 150 DPI A4) so Vietnamese diacritics
  // and Unicode chemical subscripts/arrows render cleanly without PDF font encoding issues.
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo bộ kết xuất báo cáo PDF.');
  }

  // White paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Top cobalt accent band
  ctx.fillStyle = '#1D4ED8';
  ctx.fillRect(0, 0, W, 14);

  const marginX = 76;
  const contentW = W - marginX * 2;
  let y = 78;

  // Header
  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('BÁO CÁO KẾT QUẢ THÍ NGHIỆM HÓA HỌC (CT GDPT 2018 — KẾT NỐI TRI THỨC)', marginX, y);
  y += 42;

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  const titleLines = wrapLines(ctx, payload.title, contentW);
  for (const line of titleLines) {
    ctx.fillText(line, marginX, y);
    y += 42;
  }

  y += 4;
  ctx.fillStyle = '#475569';
  ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
  const dateStr = payload.createdAtText || new Date().toLocaleString('vi-VN');
  ctx.fillText(`Thời gian thực hiện: ${dateStr}   ·   Loại phản ứng: ${payload.reactionType}`, marginX, y);
  y += 28;

  // Divider
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();
  y += 38;

  // Balanced equation highlight box
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.fillRect(marginX, y, contentW, 114);
  ctx.strokeRect(marginX, y, contentW, 114);

  ctx.fillStyle = '#1D4ED8';
  ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('PHƯƠNG TRÌNH HÓA HỌC ĐÃ CÂN BẰNG', marginX + 24, y + 34);

  ctx.fillStyle = '#0F172A';
  ctx.font = '600 26px "IBM Plex Mono", monospace';
  const eqLines = wrapLines(ctx, payload.balancedEquation, contentW - 48);
  ctx.fillText(eqLines[0] || '', marginX + 24, y + 78);
  y += 148;

  // Section 1: Summary Table (Reactants, Masses, Products)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('1. Bảng thành phần chất trộn, số mol và khối lượng', marginX, y);
  y += 22;

  const colWidths = [300, 170, 160, 190, 268];
  const headers = ['Chất hóa học', 'Vai trò', 'Số mol (mol)', 'Khối lượng (g)', 'Trạng thái & Màu sắc'];

  // Table header
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(marginX, y, contentW, 44);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
  let cx = marginX + 14;
  headers.forEach((h, i) => {
    ctx.fillText(h, cx, y + 28);
    cx += colWidths[i];
  });
  y += 44;

  const rows: string[][] = [
    [
      `${payload.reactantAName} (${payload.reactantAFormula})`,
      'Chất tham gia A',
      payload.stoichiometry.reactantAMolesInitial.toFixed(4),
      `${payload.reactantAMassG.toFixed(2)} g (dư ${payload.stoichiometry.reactantAMassRemainingG.toFixed(2)} g)`,
      payload.colorBefore,
    ],
    [
      `${payload.reactantBName} (${payload.reactantBFormula})`,
      'Chất tham gia B',
      payload.stoichiometry.reactantBMolesInitial.toFixed(4),
      `${payload.reactantBMassG.toFixed(2)} g (dư ${payload.stoichiometry.reactantBMassRemainingG.toFixed(2)} g)`,
      'Dung dịch / Chất rắn ban đầu',
    ],
    ...payload.stoichiometry.productsProduced.map((p) => [
      `${p.name} (${p.formula})`,
      'Sản phẩm tạo thành',
      p.moles.toFixed(4),
      `${p.massG.toFixed(2)} g`,
      `${p.stateLabel} · ${p.colorLabel}`,
    ]),
  ];

  rows.forEach((row, idx) => {
    const rowH = 54;
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(marginX, y, contentW, rowH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, rowH);

    ctx.fillStyle = '#0F172A';
    ctx.font = '500 15px "DM Sans", system-ui, sans-serif';
    let rx = marginX + 14;
    row.forEach((cell, ci) => {
      const clipped = cell.length > 34 ? `${cell.slice(0, 32)}…` : cell;
      ctx.fillText(clipped, rx, y + 32);
      rx += colWidths[ci];
    });
    y += rowH;
  });

  y += 26;
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 17px "IBM Plex Mono", monospace';
  ctx.fillText(
    `Tổng khối lượng trước PƯ: ${payload.stoichiometry.totalMassBeforeG.toFixed(2)} g   |   Tổng khối lượng sau PƯ (Bảo toàn KL): ${payload.stoichiometry.totalMassAfterG.toFixed(2)} g`,
    marginX,
    y,
  );
  y += 48;

  // Section 2: Color & State Change
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('2. Hiện tượng màu sắc, trạng thái và nhiệt phản ứng', marginX, y);
  y += 28;

  const infoItems = [
    ['Màu sắc ban đầu:', payload.colorBefore],
    ['Màu sắc sau phản ứng:', payload.colorAfter],
    ['Biến đổi trạng thái (kết tủa / khí):', payload.stateChange],
    ['Hiệu ứng nhiệt / Điều kiện:', payload.thermalNote],
  ];

  for (const [label, val] of infoItems) {
    ctx.fillStyle = '#475569';
    ctx.font = '600 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label, marginX, y);
    ctx.fillStyle = '#0F172A';
    ctx.font = '400 17px "DM Sans", system-ui, sans-serif';
    const valLines = wrapLines(ctx, val, contentW - 310);
    valLines.forEach((vl, li) => {
      ctx.fillText(vl, marginX + 310, y + li * 24);
    });
    y += Math.max(30, valLines.length * 24 + 8);
  }

  y += 22;
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('3. Giải thích cơ chế và nhận xét thí nghiệm', marginX, y);
  y += 30;

  ctx.fillStyle = '#334155';
  ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
  const obsLines = wrapLines(ctx, payload.observationDetail, contentW);
  for (const line of obsLines) {
    ctx.fillText(line, marginX, y);
    y += 28;
  }

  // Footer
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(marginX, H - 90);
  ctx.lineTo(W - marginX, H - 90);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '400 15px "DM Sans", system-ui, sans-serif';
  ctx.fillText('Xuất từ Phòng Thí Nghiệm Hóa Học 3D — Chương trình Kết nối tri thức với cuộc sống (Lớp 10, 11, 12)', marginX, H - 54);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);

  const safeSlug = `${payload.reactantAFormula}_${payload.reactantBFormula}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Bao_cao_thi_nghiem_${safeSlug || 'hoa_hoc'}.pdf`;
  pdf.save(filename);
  return filename;
}
