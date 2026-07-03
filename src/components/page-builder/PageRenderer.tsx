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
import { motion, useReducedMotion } from 'framer-motion';
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

interface AnimatedBlockProps {
  block: CampaignPageVersion['structureJson']['sections'][0]['blocks'][0];
  ctx: BlockRenderContext;
}

const AnimatedBlock = ({ block, ctx }: AnimatedBlockProps) => {
  const shouldReduceMotion = useReducedMotion();
  const animConfig = ((block.props || {}) as { animation?: Record<string, unknown> }).animation || {};
  const type = (animConfig.type as string) || 'none';

  if (type === 'none' || shouldReduceMotion) {
    return <BlockRenderer block={block} ctx={ctx} />;
  }

  const duration = (typeof animConfig.duration === 'number' ? animConfig.duration : 400) / 1000;
  const delay = (typeof animConfig.delay === 'number' ? animConfig.delay : 0) / 1000;
  const trigger = (animConfig.trigger as string) || 'on-load';

  const variants = {
    hidden: {
      opacity: 0,
      y: type === 'slide' ? 24 : 0,
      scale: type === 'scale' || type === 'zoom' ? 0.95 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration,
        delay,
        ease: [0.23, 1, 0.32, 1] as const,
      },
    },
  };

  const isScroll = trigger === 'on-scroll';

  return (
    <motion.div
      initial="hidden"
      whileInView={isScroll ? "visible" : undefined}
      animate={!isScroll ? "visible" : undefined}
      viewport={isScroll ? { once: true, margin: "-100px" } : undefined}
      variants={variants}
      style={{ willChange: 'transform, opacity' }}
    >
      <BlockRenderer block={block} ctx={ctx} />
    </motion.div>
  );
};

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
        const sectionProps = (section.props || {}) as {
          heading?: string;
          visibilityDevice?: string;
          columnsProps?: Record<string, unknown>;
          visibilityBehavior?: string;
          visibilityTag?: string;
          paddingTop?: string;
          paddingBottom?: string;
          paddingLeft?: string;
          paddingRight?: string;
          minHeight?: string;
          backgroundType?: string;
          backgroundColor?: string;
          gradientAngle?: number;
          gradientFrom?: string;
          gradientTo?: string;
          backgroundImageUrl?: string;
          backgroundVideoUrl?: string;
          backgroundAttachment?: string;
          backgroundSize?: string;
          backgroundPosition?: string;
          backgroundRepeat?: string;
          layout?: string;
          columnGap?: string;
          verticalAlign?: string;
          overlayColor?: string;
          overlayOpacity?: number;
        };
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
          backgroundImage: bgType === 'gradient'
            ? `linear-gradient(${sectionProps.gradientAngle ?? 135}deg, ${sectionProps.gradientFrom || '#3B5FFF'}, ${sectionProps.gradientTo || '#7C3AED'})`
            : bgType === 'image' && sectionProps.backgroundImageUrl ? `url(${sectionProps.backgroundImageUrl})` : undefined,
          backgroundAttachment: sectionProps.backgroundAttachment || 'scroll',
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
            const colVal = ((b.props || {}) as { column?: number }).column ?? 0;
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
                {columnsBlocks.map((colBlocks, colIdx) => {
                  const columnsProps = (sectionProps.columnsProps as Record<string, Record<string, unknown>> | undefined) || {};
                  const colProp = columnsProps[colIdx.toString()] || {};
                  const colStyle: React.CSSProperties = {
                    backgroundColor: (colProp.backgroundColor as string) || undefined,
                    paddingTop: (colProp.paddingTop as string) || undefined,
                    paddingBottom: (colProp.paddingBottom as string) || undefined,
                    paddingLeft: (colProp.paddingLeft as string) || undefined,
                    paddingRight: (colProp.paddingRight as string) || undefined,
                    borderRadius: (colProp.borderRadius as string) || undefined,
                    alignSelf: sectionProps.verticalAlign === 'center' ? 'center' : sectionProps.verticalAlign === 'bottom' ? 'end' : 'stretch',
                  };
                  return (
                    <div key={colIdx} style={colStyle} className="flex-1 flex flex-col gap-4">
                      {colBlocks.map((block) => (
                        <AnimatedBlock key={block.id} block={block} ctx={ctx} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
