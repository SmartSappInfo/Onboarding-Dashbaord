/**
 * ARCHITECTURE:
 * Multi-Platform Channel Publishing & Pre-Flight Validation Engine (Phase 8)
 * 
 * Manages destination channel specifications (YouTube, Facebook, Instagram, LinkedIn, CRM Asset Hub),
 * pre-flight validation checklists, and identifier normalization.
 * 
 * CAUTION:
 * Never bypass validation errors when workspace strict approval mode is active.
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-publish.test.ts
 */

import type {
  CreativeProject,
  CreativeDocument,
  PublishingChannel,
  PreFlightCheckItem,
  ConnectedChannel,
} from './creative-types';

export interface ChannelSpec {
  id: PublishingChannel;
  name: string;
  recommendedAspectRatio: string;
  targetPlaceholder: string;
  iconName: string;
  brandColor: string;
  description: string;
}

export const CHANNEL_SPECS: Record<PublishingChannel, ChannelSpec> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    recommendedAspectRatio: '16:9',
    targetPlaceholder: 'Video ID (e.g. dQw4w9WgXcQ)',
    iconName: 'Youtube',
    brandColor: '#ef4444',
    description: 'Video Cover & Custom High-CTR Thumbnail',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    recommendedAspectRatio: '1:1',
    targetPlaceholder: 'Page ID or Ad Campaign ID',
    iconName: 'Facebook',
    brandColor: '#3b82f6',
    description: 'Feed Post, Carousel Card & Ad Banner',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    recommendedAspectRatio: '9:16',
    targetPlaceholder: 'Media Container or Reel ID',
    iconName: 'Instagram',
    brandColor: '#ec4899',
    description: 'Reels Cover, Story & Feed Post',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    recommendedAspectRatio: '1.91:1',
    targetPlaceholder: 'Company Page URN or Post ID',
    iconName: 'Linkedin',
    brandColor: '#0284c7',
    description: 'B2B Media Post & Article Hero Header',
  },
  crm_asset: {
    id: 'crm_asset',
    name: 'CRM Asset Hub',
    recommendedAspectRatio: '16:9',
    targetPlaceholder: 'Campaign Tag or Email Template ID',
    iconName: 'Zap',
    brandColor: '#10b981',
    description: 'Dynamic Email & Message Marketing Asset',
  },
};

export const SAMPLE_CONNECTED_CHANNELS: ConnectedChannel[] = [
  {
    id: 'conn-yt',
    channel: 'youtube',
    accountName: 'SmartSapp Academy (Official)',
    connected: true,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'conn-fb',
    channel: 'facebook',
    accountName: 'SmartSapp Global Page',
    connected: true,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'conn-li',
    channel: 'linkedin',
    accountName: 'SmartSapp Tech B2B',
    connected: true,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'conn-crm',
    channel: 'crm_asset',
    accountName: 'Workspace Marketing Hub',
    connected: true,
    lastSyncedAt: new Date().toISOString(),
  },
];

/**
 * Normalizes user-entered raw URLs or identifiers into clean platform IDs.
 */
export function normalizeTargetIdentifier(channel: PublishingChannel, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (channel === 'youtube') {
    // Extract video ID from youtube.com/watch?v=XYZ or youtu.be/XYZ
    const match = trimmed.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/)([^&#?]+)/i);
    return match && match[1] ? match[1] : trimmed;
  }

  return trimmed;
}

/**
 * Executes a comprehensive pre-flight verification checklist before distribution.
 */
export function validatePreFlightPublishing(
  project: CreativeProject,
  document: CreativeDocument,
  channel: PublishingChannel,
  requireApproval: boolean = false
): PreFlightCheckItem[] {
  const checks: PreFlightCheckItem[] = [];

  // 1. Phase 7 Editorial Approval Gate
  if (requireApproval && project.status !== 'approved') {
    checks.push({
      id: 'approval-gate',
      label: 'Editorial Sign-off',
      passed: false,
      severity: 'error',
      message: `Project is currently in "${project.status}" state. Approval is required prior to public release.`,
    });
  } else {
    checks.push({
      id: 'approval-gate',
      label: 'Editorial Sign-off',
      passed: true,
      severity: 'error',
      message: 'Design is approved for publication.',
    });
  }

  // 2. Format / Aspect Ratio Compatibility
  const spec = CHANNEL_SPECS[channel];
  const isOptimalFormat =
    (channel === 'youtube' && document.format === 'youtube_thumbnail') ||
    (channel === 'instagram' && (document.format === 'story' || document.format === 'square')) ||
    (channel === 'facebook' && (document.format === 'square' || document.format === 'youtube_thumbnail')) ||
    (channel === 'linkedin' && (document.format === 'youtube_thumbnail' || document.format === 'square')) ||
    channel === 'crm_asset';

  if (!isOptimalFormat) {
    checks.push({
      id: 'aspect-ratio',
      label: 'Format Compatibility',
      passed: false,
      severity: 'warning',
      message: `Document format "${document.format}" may be letterboxed on ${spec.name} (recommended: ${spec.recommendedAspectRatio}).`,
    });
  } else {
    checks.push({
      id: 'aspect-ratio',
      label: 'Format Compatibility',
      passed: true,
      severity: 'warning',
      message: `Matches recommended ${spec.recommendedAspectRatio} aspect ratio for ${spec.name}.`,
    });
  }

  // 3. Minimum Content Integrity
  const hasElements = document.elements.length > 0;
  checks.push({
    id: 'content-elements',
    label: 'Visual Content',
    passed: hasElements,
    severity: 'error',
    message: hasElements ? `${document.elements.length} visual layers detected.` : 'Canvas is empty.',
  });

  // 4. Safe Zones Margin Check
  const outOfBounds = document.elements.some((el) => {
    const r = (el.x || 0) + (el.width || 0);
    const b = (el.y || 0) + (el.height || 0);
    return (el.x || 0) < 0 || (el.y || 0) < 0 || r > 100 || b > 100;
  });

  checks.push({
    id: 'safe-zones',
    label: 'Safe Zones Clearance',
    passed: !outOfBounds,
    severity: 'warning',
    message: outOfBounds
      ? 'Some elements extend beyond the canvas bounds.'
      : 'All layers are positioned safely within margins.',
  });

  return checks;
}
