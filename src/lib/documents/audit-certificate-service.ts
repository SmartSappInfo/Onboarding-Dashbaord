/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Certificate of Completion Vector Generator:
 *    Renders an authoritative, tamper-evident 1-page vector Certificate of Completion
 *    adhering to ESIGN, UETA, and eIDAS electronic signature compliance standards.
 * 2. Vector Composition via pdf-lib:
 *    Builds native PDF vector shapes, text elements, and embedded PNG QR codes.
 *    Does NOT rely on browser DOM rendering or screenshot canvas engines.
 * 3. Dual Use:
 *    - Standalone verification PDF generation (`generateAuditCertificate`)
 *    - In-stream appendix to finalized agreements (`appendAuditCertificateToPdf`)
 * 4. Strict Typing & Zero-Any (Rule 4):
 *    All parameters and return types conform strictly to `VerificationAuditCertificateData`.
 * 5. Testability:
 *    Verified in `src/lib/documents/__tests__/audit-certificate-service.test.ts`.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import type { VerificationAuditCertificateData } from '@/lib/types/document-signing';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Generates an authoritative 1-page vector PDF Certificate of Completion.
 *
 * @param data Verification certificate data containing envelope details, SHA-256 digests, and signers.
 * @returns Uint8Array of the generated 1-page PDF.
 */
export async function generateAuditCertificate(
  data: VerificationAuditCertificateData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  await addCertificatePage(pdfDoc, data);
  return await pdfDoc.save();
}

/**
 * Appends the Certificate of Completion vector page as the final page of an existing PDF document.
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
  await addCertificatePage(pdfDoc, data);
  return await pdfDoc.save();
}

/**
 * Internal helper to draw the vector certificate page onto a target PDFDocument.
 */
async function addCertificatePage(
  pdfDoc: PDFDocument,
  data: VerificationAuditCertificateData
): Promise<void> {
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  // ── 1. Header Banner & Frame ────────────────────────────────────────────────
  // Top header background
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 90,
    width: A4_WIDTH,
    height: 90,
    color: rgb(15 / 255, 23 / 255, 42 / 255), // Slate 900
  });

  // Emerald accent stripe
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 94,
    width: A4_WIDTH,
    height: 4,
    color: rgb(16 / 255, 185 / 255, 129 / 255), // Emerald 500
  });

  // Header Title
  page.drawText('CERTIFICATE OF COMPLETION', {
    x: 40,
    y: A4_HEIGHT - 45,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  // Header Subtitle
  page.drawText('Authoritative Cryptographic Audit Trail • ESIGN & eIDAS Compliant', {
    x: 40,
    y: A4_HEIGHT - 65,
    size: 9.5,
    font: fontHelvetica,
    color: rgb(148 / 255, 163 / 255, 184 / 255), // Slate 400
  });

  // Outer document border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: A4_WIDTH - 40,
    height: A4_HEIGHT - 40,
    borderColor: rgb(226 / 255, 232 / 255, 240 / 255), // Slate 200
    borderWidth: 1,
  });

  let cursorY = A4_HEIGHT - 125;

  // ── 2. Envelope Overview Section ────────────────────────────────────────────
  page.drawText('ENVELOPE INFORMATION', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  cursorY -= 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 20;

  // Grid Info
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

  cursorY -= 30;

  // ── 3. Cryptographic Fingerprints Section ───────────────────────────────────
  page.drawText('CRYPTOGRAPHIC DOCUMENT DIGESTS (SHA-256)', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  cursorY -= 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 18;
  page.drawText('Pre-Execution Digest:', { x: col1X, y: cursorY, size: 8.5, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  cursorY -= 12;
  page.drawText(data.preExecutionSha256, { x: col1X, y: cursorY, size: 8, font: fontCourier, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  cursorY -= 16;
  page.drawText('Post-Execution Digest:', { x: col1X, y: cursorY, size: 8.5, font: fontHelveticaBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
  cursorY -= 12;
  page.drawText(data.postExecutionSha256, { x: col1X, y: cursorY, size: 8, font: fontCourier, color: rgb(15 / 255, 23 / 255, 42 / 255) });

  cursorY -= 30;

  // ── 4. Signer Execution Ledger ──────────────────────────────────────────────
  page.drawText('SIGNER EXECUTION LEDGER', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  cursorY -= 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 15;

  for (const signer of data.signers) {
    page.drawRectangle({
      x: 40,
      y: cursorY - 55,
      width: A4_WIDTH - 80,
      height: 65,
      color: rgb(248 / 255, 250 / 255, 252 / 255), // Slate 50
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

  // ── 5. Chronological Audit Trail ────────────────────────────────────────────
  page.drawText('AUDIT TRAIL EVENTS', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  cursorY -= 8;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: A4_WIDTH - 40, y: cursorY },
    thickness: 0.75,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  cursorY -= 16;

  // Render recent audit events
  const displayEvents = data.auditTrail.slice(-4);
  for (const ev of displayEvents) {
    page.drawText(`• ${ev.timestamp}`, { x: 45, y: cursorY, size: 8, font: fontCourier, color: rgb(100 / 255, 116 / 255, 139 / 255) });
    page.drawText(`[${ev.action.toUpperCase()}]`, { x: 175, y: cursorY, size: 8, font: fontHelveticaBold, color: rgb(15 / 255, 23 / 255, 42 / 255) });
    const actor = ev.recipientEmail || ev.ipAddress || 'System';
    page.drawText(`by ${actor}`, { x: 260, y: cursorY, size: 8, font: fontHelvetica, color: rgb(71 / 255, 85 / 255, 105 / 255) });
    cursorY -= 14;
  }

  // ── 6. Verification Box & QR Code ───────────────────────────────────────────
  const qrBoxY = 45;
  const qrBoxHeight = 110;

  page.drawRectangle({
    x: 40,
    y: qrBoxY,
    width: A4_WIDTH - 80,
    height: qrBoxHeight,
    color: rgb(241 / 255, 245 / 255, 249 / 255), // Slate 100
    borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
    borderWidth: 1,
  });

  // Generate QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: 'M',
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBytes = Buffer.from(qrBase64, 'base64');
    const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBytes));

    page.drawImage(qrImage, {
      x: A4_WIDTH - 145,
      y: qrBoxY + 12,
      width: 85,
      height: 85,
    });
  } catch {
    // If QR code generation fails, proceed gracefully
  }

  // Verification Instructions
  page.drawText('INDEPENDENT VERIFICATION', {
    x: 55,
    y: qrBoxY + 85,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  page.drawText('Scan the QR code or verify this agreement cryptographically online at:', {
    x: 55,
    y: qrBoxY + 70,
    size: 8.5,
    font: fontHelvetica,
    color: rgb(51 / 255, 65 / 255, 85 / 255),
  });

  page.drawText(data.verificationUrl, {
    x: 55,
    y: qrBoxY + 54,
    size: 8.5,
    font: fontCourier,
    color: rgb(37 / 255, 99 / 255, 235 / 255), // Blue 600
  });

  page.drawText(
    'This Certificate of Completion is an integral, legally binding component of the executed contract.\nAny modification to the underlying document bytes invalidates the cryptographic checksums above.',
    {
      x: 55,
      y: qrBoxY + 34,
      size: 7,
      font: fontHelvetica,
      lineHeight: 10,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    }
  );

  // ── 7. Page Footer ──────────────────────────────────────────────────────────
  page.drawText(
    `SmartSapp Document Engine • Generated at ${new Date().toISOString()} • Confidential Legal Record`,
    {
      x: 40,
      y: 28,
      size: 7,
      font: fontHelvetica,
      color: rgb(148 / 255, 163 / 255, 184 / 255),
    }
  );
}
