'use client';

/**
 * The generic published-page renderer. Walks the section/block tree and renders
 * every block through the shared registry (`BlockRenderer`, view mode), so the
 * published page matches the editor exactly.
 *
 * Theme tokens are emitted as CSS variables; section reveal uses CSS-only
 * staggered animation (transform/opacity, with a reduced-motion opt-out) to
 * avoid JS motion on first paint.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { BlockRenderer } from './BlockRenderer';
import { themeToCssVars } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import type { BuilderResources, CampaignPageVersion, ResolvedTheme } from '@/lib/types';
import { cn } from '@/lib/utils';
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

const EMPTY_RESOURCES: BuilderResources = { forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] };

export function PageRenderer({
  page,
  version,
  theme,
  resources = EMPTY_RESOURCES,
  interpolate,
  fireTrigger,
}: PageRendererProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        const sectionProps = section.props || {};
        const heading = typeof sectionProps.heading === 'string' ? sectionProps.heading : '';

        // Device Visibility overrides
        const visibilityDevice = sectionProps.visibilityDevice || 'all';
        const visibilityClass =
          visibilityDevice === 'desktop'
            ? 'hidden md:block'
            : visibilityDevice === 'mobile'
            ? 'block md:hidden'
            : 'block';

        // Spacing attributes
        const padTop = sectionProps.paddingTop || '2.5rem';
        const padBottom = sectionProps.paddingBottom || '2.5rem';
        const padLeft = sectionProps.paddingLeft || '1.5rem';
        const padRight = sectionProps.paddingRight || '1.5rem';
        const minHeight = sectionProps.minHeight || 'auto';

        // Background styling
        const bgType = sectionProps.backgroundType || 'none';
        const overlayCol = sectionProps.overlayColor || '#000000';
        const overlayOp = sectionProps.overlayOpacity !== undefined ? sectionProps.overlayOpacity : 0;

        const sectionStyle: React.CSSProperties = {
          position: 'relative',
          overflow: 'hidden',
          paddingTop: padTop,
          paddingBottom: padBottom,
          paddingLeft: padLeft,
          paddingRight: padRight,
          minHeight: minHeight,
          backgroundColor: bgType === 'color' ? sectionProps.backgroundColor : undefined,
          backgroundImage: bgType === 'image' && sectionProps.backgroundImageUrl ? `url(${sectionProps.backgroundImageUrl})` : undefined,
          backgroundSize: sectionProps.backgroundSize || 'cover',
          backgroundPosition: sectionProps.backgroundPosition || 'center',
          backgroundRepeat: sectionProps.backgroundRepeat || 'no-repeat',
          animationDelay: `${idx * 80}ms`,
        };

        // Layout settings
        const layout = sectionProps.layout || '1-col';
        const colsCount = layout === '2-col' ? 2 : layout === '3-col' ? 3 : layout === '4-col' ? 4 : layout === 'grid' ? 2 : 1;

        // Partition blocks by column index
        const columnsBlocks = Array.from({ length: colsCount }, (_, colIdx) => {
          return section.blocks.filter(b => {
            const colVal = b.props.column ?? 0;
            if (colIdx === colsCount - 1) {
              return colVal >= colIdx;
            }
            return colVal === colIdx;
          });
        });

        const colGapClass = sectionProps.columnGap === 'small' ? 'gap-4' : sectionProps.columnGap === 'large' ? 'gap-12' : 'gap-8';
        const alignClass = sectionProps.verticalAlign === 'center' ? 'items-center' : sectionProps.verticalAlign === 'bottom' ? 'items-end' : 'items-start';

        let gridStyle: React.CSSProperties = {};
        if (layout === '2-col') {
          gridStyle = { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
        } else if (layout === '3-col') {
          gridStyle = { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' };
        } else if (layout === '4-col') {
          gridStyle = { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' };
        } else if (layout === 'grid') {
          gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
        }

        return (
          <section
            key={section.id}
            className={cn(
              "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none",
              visibilityClass
            )}
            style={sectionStyle}
            data-behavior={sectionProps.visibilityBehavior}
            data-tag={sectionProps.visibilityTag}
          >
            {/* HTML5 Video Loop Background */}
            {bgType === 'video' && sectionProps.backgroundVideoUrl && isMounted && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <video
                  src={sectionProps.backgroundVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Color Overlay Layer */}
            {overlayOp > 0 && (
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  backgroundColor: overlayCol,
                  opacity: overlayOp,
                }}
              />
            )}

            <div className="max-w-4xl mx-auto relative z-20">
              {heading ? (
                <h2
                  className="text-2xl font-bold tracking-tight mb-8"
                  style={{ color: theme.colors.text, fontFamily: theme.typography.headingFont }}
                >
                  {interpolate(heading)}
                </h2>
              ) : null}

              <div
                className={cn("w-full grid", colGapClass, alignClass)}
                style={layout !== '1-col' ? gridStyle : undefined}
              >
                {columnsBlocks.map((colBlocks, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-4">
                    {colBlocks.map((block) => (
                      <BlockRenderer key={block.id} block={block} ctx={ctx} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
