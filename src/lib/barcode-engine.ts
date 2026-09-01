/**
 * @fileoverview Enterprise Lossless Vector Barcode Engine
 * Pure TypeScript implementation supporting Code 128, Code 39, and EAN-13 / UPC-A.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Code 128 uses Modulo-103 checksum calculation.
 * - EAN-13 uses Modulo-10 check digit calculation.
 * - Output is pure vector SVG with optional human-readable text labels.
 * - Zero `any` or `any[]` typing.
 */

import type { BarcodeSymbology, BarcodeDesign } from '@/lib/types';
import DOMPurify from 'isomorphic-dompurify';

export interface BarcodeRenderResult {
  svg: string;
  dataUrl?: string;
  width: number;
  height: number;
  checksumValid: boolean;
  computedText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Code 128 (Subset B) Tables & Checksum
// ─────────────────────────────────────────────────────────────────────────────

const CODE128_B_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const CODE128_B_START = 104; // Subset B start code value
const CODE128_STOP = 106;

export function encodeCode128B(text: string): { modules: boolean[]; checksumValid: boolean; computedText: string } {
  if (!text) return { modules: [], checksumValid: false, computedText: text };

  let checksum = CODE128_B_START;
  const values: number[] = [CODE128_B_START];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      values.push(code);
      checksum += code * (i + 1);
    }
  }

  const checkValue = checksum % 103;
  values.push(checkValue);
  values.push(CODE128_STOP);

  const modules: boolean[] = [];

  for (const val of values) {
    const pattern = CODE128_B_PATTERNS[val];
    if (!pattern) continue;
    let isBar = true;
    for (const char of pattern) {
      const width = parseInt(char, 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
      isBar = !isBar;
    }
  }

  return { modules, checksumValid: true, computedText: text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Code 39 Patterns
// ─────────────────────────────────────────────────────────────────────────────

const CODE39_MAP: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

export function encodeCode39(rawText: string): { modules: boolean[]; checksumValid: boolean; computedText: string } {
  const upper = rawText.toUpperCase();
  const textWithGuards = `*${upper}*`;
  const modules: boolean[] = [];

  for (let i = 0; i < textWithGuards.length; i++) {
    const char = textWithGuards[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP[' '];
    
    // Pattern is 9 bits: 0 = narrow, 1 = wide
    // Elements alternate: bar, space, bar, space, bar, space, bar, space, bar
    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      const width = isWide ? 3 : 1;
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
    }
    // Inter-character space (narrow space)
    modules.push(false);
  }

  return { modules, checksumValid: true, computedText: upper };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EAN-13 & UPC-A Checksum & Encoding
// ─────────────────────────────────────────────────────────────────────────────

const EAN_L_CODES = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G_CODES = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R_CODES = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];

const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

export function calculateEan13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i] || '0', 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function encodeEan13(rawDigits: string): { modules: boolean[]; checksumValid: boolean; computedText: string } {
  const digitsOnly = rawDigits.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
  const checkDigit = calculateEan13CheckDigit(digitsOnly);
  const fullEan = `${digitsOnly}${checkDigit}`;

  const firstDigit = parseInt(fullEan[0], 10);
  const parity = EAN_PARITY[firstDigit];

  const modules: boolean[] = [];

  // Start Guard (101)
  modules.push(true, false, true);

  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(fullEan[i], 10);
    const useG = parity[i - 1] === 'G';
    const pattern = useG ? EAN_G_CODES[digit] : EAN_L_CODES[digit];
    for (const bit of pattern) {
      modules.push(bit === '1');
    }
  }

  // Center Guard (01010)
  modules.push(false, true, false, true, false);

  // Right 6 digits
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(fullEan[i], 10);
    const pattern = EAN_R_CODES[digit];
    for (const bit of pattern) {
      modules.push(bit === '1');
    }
  }

  // Stop Guard (101)
  modules.push(true, false, true);

  return { modules, checksumValid: true, computedText: fullEan };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Unified Vector Barcode Renderer
// ─────────────────────────────────────────────────────────────────────────────

export function renderBarcodeVector(
  text: string,
  design?: Partial<BarcodeDesign>
): BarcodeRenderResult {
  const symbology: BarcodeSymbology = design?.symbology || 'code128';
  const barColor = design?.barColor || '#000000';
  const bgColor = design?.backgroundColor || '#FFFFFF';
  const height = design?.height || 100;
  const margin = design?.margin ?? 12;
  const showText = design?.showText !== false;
  const fontSize = design?.fontSize || 13;

  let encodingResult: { modules: boolean[]; checksumValid: boolean; computedText: string };

  if (symbology === 'ean13' || symbology === 'upca') {
    encodingResult = encodeEan13(text);
  } else if (symbology === 'code39') {
    encodingResult = encodeCode39(text);
  } else {
    encodingResult = encodeCode128B(text);
  }

  const { modules, checksumValid, computedText } = encodingResult;
  const moduleWidth = 2; // px per narrow bar
  const barcodeWidth = modules.length * moduleWidth;
  const totalWidth = barcodeWidth + margin * 2;
  const totalHeight = height + (showText ? fontSize + 12 : 0) + margin * 2;

  let rectsSvg = '';
  for (let i = 0; i < modules.length; i++) {
    if (modules[i]) {
      const x = margin + i * moduleWidth;
      rectsSvg += `<rect x="${x}" y="${margin}" width="${moduleWidth}" height="${height}" fill="${barColor}" />`;
    }
  }

  let textSvg = '';
  if (showText) {
    const textY = margin + height + fontSize + 2;
    textSvg = `<text x="${totalWidth / 2}" y="${textY}" font-family="monospace, monospace" font-size="${fontSize}" font-weight="700" fill="${barColor}" text-anchor="middle" letter-spacing="1">${computedText}</text>`;
  }

  const rawSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
      <rect width="100%" height="100%" fill="${bgColor}" />
      ${rectsSvg}
      ${textSvg}
    </svg>
  `.trim();

  const sanitizedSvg = DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } });

  return {
    svg: sanitizedSvg,
    width: totalWidth,
    height: totalHeight,
    checksumValid,
    computedText,
  };
}
