/**
 * {{Org_name}} Experience Platform — Pure Client-Safe Theme Resolvers
 *
 * Provides pure, testable functions to transform portal theme configurations
 * into live CSS variables, dynamic Google Fonts URLs, and button treatment styles.
 *
 * NOTE: This file is strictly client-safe (0 server dependencies, 0 firebase-admin imports).
 * It can be safely imported by 'use client' React components.
 */

import type * as React from 'react';
import type { PortalThemeConfig } from '@/lib/types/portal';

/**
 * Returns CSS radius value corresponding to the configured UI border radius.
 */
export function getPortalRadiusCss(borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'): string {
  switch (borderRadius) {
    case 'none':
      return '0px';
    case 'sm':
      return '0.375rem'; // 6px
    case 'md':
      return '0.75rem'; // 12px
    case 'lg':
      return '1rem'; // 16px
    case 'full':
      return '9999px';
    default:
      return '0.75rem';
  }
}

/**
 * Generates a Google Fonts stylesheet URL for the configured heading and body fonts.
 */
export function getGoogleFontsUrl(headingFont?: string, bodyFont?: string): string {
  const fonts = new Set<string>();
  if (headingFont) fonts.add(headingFont);
  if (bodyFont) fonts.add(bodyFont);

  // Standard safe web fonts that do not require Google Fonts download
  const standardSystemFonts = new Set(['sans-serif', 'serif', 'monospace', 'system-ui']);
  const familiesToFetch = Array.from(fonts).filter(f => !standardSystemFonts.has(f.toLowerCase()));

  if (familiesToFetch.length === 0) {
    return '';
  }

  const familyParams = familiesToFetch
    .map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800;900`)
    .join('&');

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

/**
 * Computes the complete CSS variable map for the given portal theme.
 */
export function getPortalThemeVariables(theme: PortalThemeConfig): Record<string, string> {
  const radiusCss = getPortalRadiusCss(theme?.ui?.borderRadius);

  return {
    '--portal-primary': theme?.colors?.primary || '#3B82F6',
    '--portal-secondary': theme?.colors?.secondary || '#1E293B',
    '--portal-accent': theme?.colors?.accent || '#6366F1',
    '--portal-bg': theme?.colors?.background || '#FFFFFF',
    '--portal-surface': theme?.colors?.surface || '#F8FAFC',
    '--portal-text': theme?.colors?.text || '#0F172A',
    '--portal-muted': theme?.colors?.mutedText || '#64748B',
    '--portal-border': theme?.colors?.border || '#E2E8F0',
    '--portal-radius': radiusCss,
    '--portal-heading-font': `${theme?.typography?.headingFont || 'Plus Jakarta Sans'}, sans-serif`,
    '--portal-body-font': `${theme?.typography?.bodyFont || 'Inter'}, sans-serif`,
  };
}

/**
 * Computes inline CSS treatment for buttons based on primary color, border radius, and style preset.
 */
export function getPortalButtonInlineStyle(
  buttonStyle: 'flat' | 'glow' | 'glass' | 'pill' | undefined,
  primaryColor: string = '#3B82F6',
  borderRadiusCss: string = '0.75rem'
): Record<string, string> {
  const baseColor = primaryColor || '#3B82F6';

  switch (buttonStyle) {
    case 'glow':
      return {
        backgroundColor: baseColor,
        borderRadius: borderRadiusCss,
        boxShadow: `0 0 20px ${baseColor}66, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`,
        border: '1px solid transparent',
      };
    case 'glass':
      return {
        backgroundColor: `${baseColor}D9`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: borderRadiusCss,
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      };
    case 'pill':
      return {
        backgroundColor: baseColor,
        borderRadius: '9999px',
        border: '1px solid transparent',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
      };
    case 'flat':
    default:
      return {
        backgroundColor: baseColor,
        borderRadius: borderRadiusCss,
        border: '1px solid transparent',
        boxShadow: 'none',
      };
  }
}
