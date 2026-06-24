'use client';

/**
 * The generic published-page renderer. Walks the section/block tree and renders
 * every block through the shared registry (`BlockRenderer`, view mode), so the
 * published page matches the editor exactly. Replaces the old hardcoded,
 * payment-specific body in `PublicPageClient`.
 *
 * Theme tokens are emitted as CSS variables; section reveal uses CSS-only
 * staggered animation (transform/opacity, with a reduced-motion opt-out) to
 * avoid JS motion on first paint.
 */
import React, { useMemo } from 'react';
import { BlockRenderer } from './BlockRenderer';
import { themeToCssVars } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import type { BuilderResources, CampaignPageVersion, ResolvedTheme } from '@/lib/types';
import '@/lib/page-builder/blocks'; // side-effect: register all blocks

export interface PageRendererPage {
  id: string;
  organizationId: string;
  workspaceIds: string[];
  settings: { customScriptsAllowed?: boolean };
}

interface PageRendererProps {
  page: PageRendererPage;
  version: CampaignPageVersion;
  theme: ResolvedTheme;
  resources?: BuilderResources;
  interpolate: (text: string) => string;
  fireTrigger: (event: string, blockId?: string) => void;
}

const EMPTY_RESOURCES: BuilderResources = { forms: [], surveys: [], agreements: [] };

export function PageRenderer({
  page,
  version,
  theme,
  resources = EMPTY_RESOURCES,
  interpolate,
  fireTrigger,
}: PageRendererProps) {
  const ctx = useMemo<BlockRenderContext>(
    () => ({
      mode: 'view',
      theme,
      interpolate,
      resources,
      fireTrigger,
      page: { id: page.id, organizationId: page.organizationId, workspaceId: page.workspaceIds[0] },
      allowScripts: page.settings.customScriptsAllowed ?? false,
    }),
    [theme, interpolate, resources, fireTrigger, page.id, page.organizationId, page.workspaceIds, page.settings.customScriptsAllowed],
  );

  const sections = version.structureJson.sections;
  const cssVars = themeToCssVars(theme) as React.CSSProperties;

  return (
    <div style={cssVars}>
      {sections.map((section, idx) => {
        const heading = typeof section.props.heading === 'string' ? section.props.heading : '';
        const background =
          typeof section.props.background === 'string' && section.props.background !== 'default'
            ? section.props.background
            : undefined;

        return (
          <section
            key={section.id}
            className="px-6 py-10 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none"
            style={{ animationDelay: `${idx * 80}ms`, background }}
          >
            <div className="max-w-4xl mx-auto space-y-8">
              {heading ? (
                <h2
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: theme.colors.text, fontFamily: theme.typography.headingFont }}
                >
                  {interpolate(heading)}
                </h2>
              ) : null}
              {section.blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} ctx={ctx} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
