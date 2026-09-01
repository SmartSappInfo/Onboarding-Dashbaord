/**
 * @fileoverview Phase 4 Unit Test Suite: AI QR Creator,
 * Multi-Channel Contextual Copywriter, Scannability Optimizer, and Canvas Theme Transformer.
 */

import { describe, it, expect } from 'vitest';
import {
  generateAiQRConfig,
  generateContextualCopy,
  transformCanvasTheme,
} from '@/lib/ai-qr-creator';
import { getContrastRatio } from '@/app/admin/qr-studio/components/designer/scannability-checker';

describe('AI QR Creator — Natural Language Prompt Parsing & Domain Inference', () => {
  it('infers education preset for school admissions prompt', async () => {
    const config = await generateAiQRConfig('Create a campus flyer for our Fall 2026 Admissions Open Day');
    expect(config.frameStyle).toBe('top-banner');
    expect(config.dotStyle).toBe('rounded');
    expect(config.ctaText).toContain('OPEN DAY');
    expect(config.campaignTags).toContain('admissions');

    const contrast = getContrastRatio(config.foregroundColor, config.backgroundColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  it('infers dining and hospitality preset for restaurant menu prompt', async () => {
    const config = await generateAiQRConfig('Table tent QR for our Rooftop Lounge cocktail and dining menu');
    expect(config.frameStyle).toBe('rounded-box');
    expect(config.ctaText).toContain('MENU');
    expect(config.campaignTags).toContain('hospitality');

    const contrast = getContrastRatio(config.foregroundColor, config.backgroundColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  it('infers guest Wi-Fi preset for lobby sign prompt', async () => {
    const config = await generateAiQRConfig('Reception guest Wi-Fi network connect sign');
    expect(config.type).toBe('wifi');
    expect(config.frameStyle).toBe('minimalist-pill');
    expect(config.ctaText).toContain('WI-FI');
  });

  it('infers retail promotion preset for discount sale prompt', async () => {
    const config = await generateAiQRConfig('Black Friday 20% discount coupon flash sale');
    expect(config.frameStyle).toBe('scan-me-badge');
    expect(config.ctaText).toContain('DISCOUNT');
  });

  it('adapts to custom workspace brand color when available', async () => {
    const customBrand = {
      primaryColor: '#4F46E5', // Custom Indigo
      orgName: 'Acme Academy',
    };

    const config = await generateAiQRConfig('Admissions flyer', customBrand);
    expect(config.foregroundColor).toBe('#4F46E5');
    const contrast = getContrastRatio(config.foregroundColor, config.backgroundColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AI Copywriter — Multi-Channel Contextual Copy Generation', () => {
  it('generates 5 tailored CTAs and structured copy for promotional campaigns', async () => {
    const copy = await generateContextualCopy('Summer VIP Sale', 'https://smartsapp.com/q/sale2025', 'url', 'promo');
    expect(copy.ctaSuggestions.length).toBe(5);
    expect(copy.ctaSuggestions.some((cta) => cta.includes('DISCOUNT') || cta.includes('SAVINGS') || cta.includes('PROMO'))).toBe(true);
    expect(copy.headline).toContain('Summer VIP Sale');
    expect(copy.whatsAppBroadcast).toContain('🌟');
    expect(copy.emailSnippet.subject).toContain('Summer VIP Sale');
    expect(copy.smsText).toContain('https://smartsapp.com/q/sale2025');
  });

  it('generates professional B2B tone copy for executive invitations', async () => {
    const copy = await generateContextualCopy('Executive Tech Summit', 'https://smartsapp.com/q/summit2026', 'event', 'b2b');
    expect(copy.ctaSuggestions.some((cta) => cta.includes('CONSULTATION') || cta.includes('WHITEPAPER') || cta.includes('CASE STUDY'))).toBe(true);
    expect(copy.instructions).toContain('Point at the QR code');
  });
});

describe('Canvas AI Theme Transformer — Natural Language Palette Resonator', () => {
  it('transforms canvas to Midnight Dark palette when requested', async () => {
    const theme = await transformCanvasTheme('Transform this poster into dark midnight theme');
    expect(theme.themeName).toBe('Midnight Dark');
    expect(theme.backgroundColor).toBe('#0F172A');
    expect(theme.primaryTextColor).toBe('#F8FAFC');
  });

  it('transforms canvas to Warm Autumn palette when requested', async () => {
    const theme = await transformCanvasTheme('Make it a warm autumn amber coffee shop aesthetic');
    expect(theme.themeName).toBe('Warm Amber Autumn');
    expect(theme.backgroundColor).toBe('#FFFBEB');
    expect(theme.primaryTextColor).toBe('#78350F');
  });
});
