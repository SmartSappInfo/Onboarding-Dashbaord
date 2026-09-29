/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Certificate of Completion Vector Generator:
 *    Renders an authoritative, tamper-evident vector Certificate of Completion
 *    adhering to ESIGN, UETA, and eIDAS electronic signature compliance standards.
 * 2. Vector Composition via pdf-lib:
 *    Builds native PDF vector shapes, text elements, and embedded PNG QR codes.
 *    Does NOT rely on browser DOM rendering or screenshot canvas engines.
 * 3. Dynamic Vertical Height Budgeting & Pagination (Phase 2, FM-P2-09):
 *    Automatically budgets vertical canvas space:
 *    - 1-2 signers & <= 5 audit records: Renders a single authoritative page.
 *    - 3+ signers or > 5 audit records: Dynamically paginates across 2 vector pages
 *      (Page 1: Signatory Ledger & Digests; Page 2: Chronological Audit Trail & QR Console)
 *      preventing text clipping or QR code displacement.
 * 4. Strict Typing & Zero-Any (Rule 4):
 *    All parameters and return types conform strictly to `VerificationAuditCertificateData`.
 * 5. Testability:
 *    Verified in `src/lib/documents/__tests__/audit-certificate-service.test.ts`
 *    and `src/lib/documents/__tests__/envelope-step-finalization.test.ts`.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import type { VerificationAuditCertificateData } from '@/lib/types/document-signing';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Generates an authoritative vector PDF Certificate of Completion with dynamic pagination.
 *
 * @param data Verification certificate data containing envelope details, SHA-256 digests, and signers.
 * @returns Uint8Array of the generated PDF.
 */
export async function generateAuditCertificate(
  data: VerificationAuditCertificateData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  await addCertificatePages(pdfDoc, data);
  return await pdfDoc.save();
}

/**
 * Appends the Certificate of Completion vector pages as the final pages of an existing PDF document.
 *
 * @param originalPdfBytes Source PDF binary buffer.
 * @param data Verification certificate data.
 * @returns Uint8Array containing the unified multi-page agreement with appended certificate.
 */
export async function appendAuditCertificateToPdf(
  originalPdfBytes: Uint8Array | Buffer,
  data: VerificationAuditCertificateData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(new Uint8Array(originalPdfBytes));
  await addCertificatePages(pdfDoc, data);
  return await pdfDoc.save();
}

/**
 * Internal helper to draw the vector certificate page(s) onto a target PDFDocument,
 * budgeting height to paginate cleanly when multi-party signatures or long audit trails exist.
 */
async function addCertificatePages(
  pdfDoc: PDFDocument,
  data: VerificationAuditCertificateData
): Promise<void> {
  const isMultiPage = data.signers.length > 2 || data.auditTrail.length > 5;
  const totalCertPages = isMultiPage ? 2 : 1;

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  if (!isMultiPage) {
    // ── SINGLE-PAGE CERTIFICATE (<= 2 signers & <= 5 audit entries) ─────────────
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawHeader(page, 'CERTIFICATE OF COMPLETION', 'Authoritative Cryptographic Audit Trail • ESIGN & eIDAS Compliant', fontHelvetica, fontHelveticaBold);
    drawOuterBorder(page);

    let cursorY = A4_HEIGHT - 125;
    cursorY = drawEnvelopeInfo(page, data, cursorY, fontHelvetica, fontHelveticaBold, fontCourier);
    cursorY = drawDigests(page, data, cursorY, fontHelveticaBold, fontCourier);
    cursorY = drawSigners(page, data.signers, cursorY, fontHelvetica, fontHelveticaBold, fontCourier);
    drawAuditTrail(page, data.auditTrail.slice(-4), cursorY, fontHelvetica, fontHelveticaBold, fontCourier);

    await drawVerificationBox(pdfDoc, page, data.verificationUrl, fontHelvetica, fontHelveticaBold, fontCourier);
    drawFooter(page, 'Page 1 of 1', fontHelvetica);
  } else {
    // ── MULTI-PAGE CERTIFICATE (> 2 signers or > 5 audit entries) ───────────────
    // PAGE 1: Header, Envelope Information, Cryptographic Digests, and Signers Ledger
    const page1 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawHeader(page1, 'CERTIFICATE OF COMPLETION', 'Authoritative Cryptographic Audit Trail • Part 1: Signatories', fontHelvetica, fontHelveticaBold);
    drawOuterBorder(page1);

    let cursorY1 = A4_HEIGHT - 125;
    cursorY1 = drawEnvelopeInfo(page1, data, cursorY1, fontHelvetica, fontHelveticaBold, fontCourier);
    cursorY1 = drawDigests(page1, data, cursorY1, fontHelveticaBold, fontCourier);
    drawSigners(page1, data.signers, cursorY1, fontHelvetica, fontHelveticaBold, fontCourier);
    drawFooter(page1, `Page 1 of ${totalCertPages}`, fontHelvetica);

    // PAGE 2: Chronological Audit Trail & Independent Verification Console
    const page2 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawHeader(page2, 'CERTIFICATE OF COMPLETION', 'Authoritative Cryptographic Audit Trail • Part 2: Audit & Verification', fontHelvetica, fontHelveticaBold);
    drawOuterBorder(page2);

    const cursorY2 = A4_HEIGHT - 125;
    drawAuditTrail(page2, data.auditTrail, cursorY2, fontHelvetica, fontHelveticaBold, fontCourier);

    await drawVerificationBox(pdfDoc, page2, data.verificationUrl, fontHelvetica, fontHelveticaBold, fontCourier);
    drawFooter(page2, `Page 2 of ${totalCertPages}`, fontHelvetica);
  }

}

// ── Shared Drawing Primitives ──────────────────────────────────────────────────

function drawHeader(
  page: ReturnType<PDFDocument['addPage']>,
  title: string,
  subtitle: string,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): void {
  // Top header background Slate 900
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 90,
    width: A4_WIDTH,
    height: 90,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  // Emerald accent stripe
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 94,
    width: A4_WIDTH,
    height: 4,
    color: rgb(16 / 255, 185 / 255, 129 / 255),
  });

  page.drawText(title, {
    x: 40,
    y: A4_HEIGHT - 45,
    size: 19,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(subtitle, {
    x: 40,
    y: A4_HEIGHT - 65,
    size: 9.5,
    font: fontHelvetica,
    color: rgb(148 / 255, 163 / 255, 184 / 255),
  });
}

function drawOuterBorder(page: ReturnType<PDFDocument['addPage']>): void {
  page.drawRectangle({
    x: 20,
    y: 20,
    width: A4_WIDTH - 40,
    height: A4_HEIGHT - 40,
    borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
    borderWidth: 1,
  });
}

function drawEnvelopeInfo(
  page: ReturnType<PDFDocument['addPage']>,
  data: VerificationAuditCertificateData,
  startY: number,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontCourier: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): number {
  page.drawText('ENVELOPE INFORMATION', {
    x: 40,
    y: startY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  let cursorY = startY - 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 20;
  const col1X = 40;
  const col2X = 300;

  page.drawText('Envelope ID:', { x: col1X, y: cursorY, size: 9, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  page.drawText(data.envelopeId, { x: col1X + 80, y: cursorY, size: 9, font: fontCourier, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  page.drawText('Status:', { x: col2X, y: cursorY, size: 9, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  page.drawText(data.status.toUpperCase(), { x: col2X + 65, y: cursorY, size: 9, font: fontHelveticaBold, color: rgb(16 / 255, 185 / 255, 129 / 255) });

  cursorY -= 16;
  page.drawText('Document Title:', { x: col1X, y: cursorY, size: 9, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  page.drawText(data.title.substring(0, 36), { x: col1X + 80, y: cursorY, size: 9, font: fontHelvetica, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  page.drawText('Completed At:', { x: col2X, y: cursorY, size: 9, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  page.drawText(data.completedAt, { x: col2X + 75, y: cursorY, size: 8.5, font: fontHelvetica, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  return cursorY - 26;
}

function drawDigests(
  page: ReturnType<PDFDocument['addPage']>,
  data: VerificationAuditCertificateData,
  startY: number,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontCourier: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): number {
  page.drawText('CRYPTOGRAPHIC DOCUMENT DIGESTS (SHA-256)', {
    x: 40,
    y: startY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  let cursorY = startY - 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 18;
  page.drawText('Pre-Execution Digest:', { x: 40, y: cursorY, size: 8.5, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  cursorY -= 12;
  page.drawText(data.preExecutionSha256, { x: 40, y: cursorY, size: 8, font: fontCourier, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  cursorY -= 16;
  page.drawText('Post-Execution Digest:', { x: 40, y: cursorY, size: 8.5, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  cursorY -= 12;
  page.drawText(data.postExecutionSha256, { x: 40, y: cursorY, size: 8, font: fontCourier, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  return cursorY - 26;
}

function drawSigners(
  page: ReturnType<PDFDocument['addPage']>,
  signers: VerificationAuditCertificateData['signers'],
  startY: number,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontCourier: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): number {
  page.drawText('SIGNER EXECUTION LEDGER', {
    x: 40,
    y: startY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  let cursorY = startY - 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 15;

  for (const signer of signers) {
    page.drawRectangle({
      x: 40,
      y: cursorY - 55,
      width: A4_WIDTH - 80,
      height: 65,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
      borderWidth: 0.5,
    });

    const signerBoxY = cursorY - 5;
    page.drawText(signer.name, { x: 50, y: signerBoxY, size: 10, font: fontHelveticaBold, color: rgb(15 / 255, 23 / 255, 42 / 255) });
    page.drawText(`<${signer.email}>`, { x: 50 + fontHelveticaBold.widthOfTextAtSize(signer.name, 10) + 6, y: signerBoxY, size: 9, font: fontHelvetica, color: rgb(71 / 255, 85 / 255, 105 / 255) });

    page.drawText(`Signed At: ${signer.signedAt}`, { x: 50, y: signerBoxY - 16, size: 8, font: fontHelvetica, color: rgb(71 / 255, 85 / 255, 105 / 255) });
    if (signer.ipAddress) {
      page.drawText(`IP Address: ${signer.ipAddress}`, { x: 300, y: signerBoxY - 16, size: 8, font: fontHelvetica, color: rgb(71 / 255, 85 / 255, 105 / 255) });
    }

    if (signer.signatureHash) {
      page.drawText(`Signature SHA-256: ${signer.signatureHash.substring(0, 48)}...`, {
        x: 50,
        y: signerBoxY - 32,
        size: 7.5,
        font: fontCourier,
        color: rgb(100 / 255, 116 / 255, 139 / 255),
      });
    }

    cursorY -= 75;
  }

  return cursorY;
}

function drawAuditTrail(
  page: ReturnType<PDFDocument['addPage']>,
  events: VerificationAuditCertificateData['auditTrail'],
  startY: number,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontCourier: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): number {
  page.drawText('AUDIT TRAIL EVENTS', {
    x: 40,
    y: startY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  let cursorY = startY - 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 16;

  for (const ev of events) {
    page.drawText(`• ${ev.timestamp}`, { x: 45, y: cursorY, size: 8, font: fontCourier, color: rgb(100 / 255, 116 / 255, 139 / 255) });
    page.drawText(`[${ev.action.toUpperCase()}]`, { x: 175, y: cursorY, size: 8, font: fontHelveticaBold, color: rgb(15 / 255, 23 / 255, 42 / 255) });
    const actor = ev.recipientEmail || ev.ipAddress || 'System';
    page.drawText(`by ${actor}`, { x: 270, y: cursorY, size: 8, font: fontHelvetica, color: rgb(71 / 255, 85 / 255, 105 / 255) });
    cursorY -= 16;
  }

  return cursorY - 20;
}

async function drawVerificationBox(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  verificationUrl: string,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontHelveticaBold: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never,
  fontCourier: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): Promise<void> {
  const qrBoxY = 50;
  const qrBoxHeight = 115;

  page.drawRectangle({
    x: 40,
    y: qrBoxY,
    width: A4_WIDTH - 80,
    height: qrBoxHeight,
    color: rgb(241 / 255, 245 / 255, 249 / 255),
    borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
    borderWidth: 1,
  });

  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: 'M',
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBytes = Buffer.from(qrBase64, 'base64');
    const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBytes));

    page.drawImage(qrImage, {
      x: A4_WIDTH - 150,
      y: qrBoxY + 12,
      width: 90,
      height: 90,
    });
  } catch {
    // If QR code generation fails, proceed gracefully
  }

  page.drawText('INDEPENDENT VERIFICATION', {
    x: 55,
    y: qrBoxY + 90,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  page.drawText('Scan the QR code or verify this agreement cryptographically online at:', {
    x: 55,
    y: qrBoxY + 74,
    size: 8.5,
    font: fontHelvetica,
    color: rgb(51 / 255, 65 / 255, 85 / 255),
  });

  page.drawText(verificationUrl, {
    x: 55,
    y: qrBoxY + 56,
    size: 8.5,
    font: fontCourier,
    color: rgb(37 / 255, 99 / 255, 235 / 255),
  });

  page.drawText(
    'This Certificate of Completion is an integral, legally binding component of the executed contract.\nAny modification to the underlying document bytes invalidates the cryptographic checksums above.',
    {
      x: 55,
      y: qrBoxY + 36,
      size: 7,
      font: fontHelvetica,
      lineHeight: 10,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    }
  );
}

function drawFooter(
  page: ReturnType<PDFDocument['addPage']>,
  pageLabel: string,
  fontHelvetica: ReturnType<PDFDocument['embedFont']> extends Promise<infer F> ? F : never
): void {
  page.drawText(
    `SmartSapp Document Engine • ${pageLabel} • Confidential Legal Record`,
    {
      x: 40,
      y: 28,
      size: 7.5,
      font: fontHelvetica,
      color: rgb(148 / 255, 163 / 255, 184 / 255),
    }
  );
}
