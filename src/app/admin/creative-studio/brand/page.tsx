/**
 * ARCHITECTURE:
 * Brand Studio Page (Phase 5)
 * 
 * Server Component fetching workspace Brand Kit tokens and AI rules.
 */

import { getWorkspaceBrandKitAction } from '@/app/actions/brand-kit-actions';
import { BrandStudioClient } from './BrandStudioClient';
import type { BrandKit } from '@/lib/creative/creative-types';

export default async function BrandStudioPage() {
  const workspaceId = 'default-workspace';
  const res = await getWorkspaceBrandKitAction(workspaceId);

  const defaultKit: BrandKit = {
    workspaceId,
    name: 'SmartSapp Brand Kit',
    colors: {
      primary: ['#10b981', '#0f172a'],
      secondary: ['#06b6d4', '#6366f1'],
      accent: ['#facc15', '#f87171'],
      neutral: ['#ffffff', '#020617'],
    },
    typography: {
      displayFont: 'Impact',
      headingFont: 'Inter',
      bodyFont: 'Inter',
    },
    aiRules: [
      {
        id: 'rule-font-1',
        type: 'font',
        rule: 'Primary headlines must strictly use display typography (Impact).',
        severity: 'required',
        active: true,
      },
      {
        id: 'rule-color-1',
        type: 'color',
        rule: 'Background gradients must incorporate primary emerald brand accents.',
        severity: 'recommended',
        active: true,
      },
      {
        id: 'rule-watermark-1',
        type: 'logo',
        rule: 'Inject workspace watermark logo on bottom/top corners.',
        severity: 'optional',
        active: false,
      },
    ],
  };

  const brandKit = res.success && res.data ? res.data : defaultKit;

  return <BrandStudioClient initialBrandKit={brandKit} workspaceId={workspaceId} />;
}
