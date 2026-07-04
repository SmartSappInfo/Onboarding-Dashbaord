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
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BlockRenderer } from './BlockRenderer';
import { themeToCssVars } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import type { 
  BuilderResources, CampaignPageVersion, ResolvedTheme, 
  OrgBranding, PageHeaderSettings, PageFooterSettings 
} from '@/lib/types';
import { cn } from '@/lib/utils';
import '@/lib/page-builder/blocks'; // side-effect: register all blocks
import { Button } from '@/components/ui/button';
import { 
  Phone, Search, Facebook, Twitter, Linkedin, 
  Instagram, Youtube, MapPin, Mail, Globe 
} from 'lucide-react';
import Footer from '@/components/footer';

export interface PageRendererPage {
  id: string;
  organizationId: string;
  workspaceIds: string[];
  settings: { 
    customScriptsAllowed?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
  };
}

interface PageRendererProps {
  page: PageRendererPage;
  version: CampaignPageVersion;
  theme: ResolvedTheme;
  resources?: BuilderResources;
  interpolate: (text: string) => string;
  fireTrigger: (event: string, blockId?: string) => void;
  orgBranding?: OrgBranding | null;
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
  orgBranding = null,
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

  // Retrieve parsed structure header/footer settings
  const headerSettings: PageHeaderSettings = version.structureJson.header || {
    preset: 'native',
    overlap: false,
    sticky: false,
    floating: false,
    showSearch: false,
    showCta: false,
    showPhone: false,
    navItems: []
  };

  const footerSettings: PageFooterSettings = version.structureJson.footer || {
    preset: 'org',
    overrideOrg: false
  };

  // Nav Item click handler
  const handleNavItemClick = useCallback((item: typeof headerSettings.navItems[0]) => {
    if (item.linkType === 'url' && item.url) {
      window.open(item.url, item.url.startsWith('http') ? '_blank' : '_self');
    } else if (item.linkType === 'scroll' && item.targetSectionId) {
      const element = document.getElementById(item.targetSectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (item.linkType === 'action' && item.action) {
      if (item.action === 'receipt_request') {
        fireTrigger('block_click', 'cta-1');
      } else {
        let type = 'form';
        let targetId = '';
        if (item.action === 'open_modal_form') {
          type = 'form';
          targetId = resources.forms?.[0]?.id || '';
        } else if (item.action === 'open_modal_survey') {
          type = 'survey';
          targetId = resources.surveys?.[0]?.id || '';
        } else if (item.action === 'open_modal_agreement') {
          type = 'agreement';
          targetId = resources.agreements?.[0]?.id || '';
        }
        fireTrigger('open_modal_resource', JSON.stringify({ type, targetId }));
      }
    }
  }, [fireTrigger, resources]);

  return (
    <div style={cssVars} className="flex flex-col min-h-screen">
      
      {/* ─── DYNAMIC HEADER RENDERER ───────────────────────────────── */}
      {page.settings.showHeader !== false && (
        <header 
          className={cn(
            "w-full z-45 transition-all",
            headerSettings.overlap ? "absolute top-0 left-0 right-0" : "relative",
            headerSettings.sticky ? "sticky top-0" : ""
          )}
        >
          <div className={cn(
            "w-full flex items-center justify-between transition-all",
            headerSettings.floating 
              ? "max-w-4xl mx-auto rounded-full border border-slate-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md py-1.5 px-6 shadow-lg shadow-black/5 mt-4"
              : "rounded-none border-b border-slate-200/40 dark:border-zinc-800/40 bg-white dark:bg-zinc-950 py-3 px-8 shadow-sm"
          )}>
            {headerSettings.preset === 'minimal' ? (
              <div className="flex items-center justify-center w-full">
                {orgBranding?.logoUrl ? (
                  <img src={orgBranding.logoUrl} alt={orgBranding.name} className="h-8 w-auto object-contain" />
                ) : (
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{orgBranding?.name || 'SmartSapp'}</span>
                )}
              </div>
            ) : headerSettings.preset === 'cta-only' ? (
              <div className="flex justify-end w-full">
                {headerSettings.showCta && (
                  <Button 
                    onClick={() => headerSettings.ctaUrl && window.open(headerSettings.ctaUrl, '_self')}
                    className="h-9 px-5 rounded-full font-bold text-xs bg-[#3B5FFF] text-white"
                  >
                    {headerSettings.ctaText || 'Get Started'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-6">
                  {orgBranding?.logoUrl ? (
                    <img src={orgBranding.logoUrl} alt={orgBranding.name} className="h-8 w-auto object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{orgBranding?.name || 'SmartSapp'}</span>
                  )}
                  {(headerSettings.preset === 'full-nav' || headerSettings.preset === 'search-nav') && (
                    <nav className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {headerSettings.navItems.map((item) => (
                        <button 
                          key={item.id} 
                          onClick={() => handleNavItemClick(item)}
                          className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {headerSettings.preset === 'search-nav' && headerSettings.showSearch && (
                    <div className="relative max-w-xs hidden sm:block">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search..." 
                        className="h-8 w-32 pl-8 pr-2 text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500/50" 
                      />
                    </div>
                  )}
                  {headerSettings.showPhone && headerSettings.phoneNumber && (
                    <a 
                      href={`tel:${headerSettings.phoneNumber}`}
                      className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1 hover:text-[#3B5FFF] transition-colors"
                    >
                      <Phone className="h-3 w-3" /> {headerSettings.phoneNumber}
                    </a>
                  )}
                  {headerSettings.showCta && (
                    <Button 
                      onClick={() => headerSettings.ctaUrl && window.open(headerSettings.ctaUrl, '_self')}
                      className="h-9 px-5 rounded-full font-bold text-xs bg-[#3B5FFF] text-white"
                    >
                      {headerSettings.ctaText || 'Get Started'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {/* ─── MAIN PAGE SECTIONS ────────────────────────────────────── */}
      <main className="flex-1 w-full relative">
        {sections.map((section, idx) => {
          const sectionProps = (section.props || {}) as {
            heading?: string;
            visibilityDevice?: string;
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
            overlayType?: string;
            overlayGradientFrom?: string;
            overlayGradientTo?: string;
            overlayGradientAngle?: number;
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

          // Adjust first section padding top if header is overlapping
          const isFirstSection = idx === 0;
          const adjustedPadTop = (isFirstSection && headerSettings.overlap && page.settings.showHeader !== false)
            ? `calc(${padTop} + ${headerSettings.floating ? '5.5rem' : '4.5rem'})`
            : padTop;

          const sectionStyle: React.CSSProperties = {
            position: 'relative',
            overflow: 'hidden',
            paddingTop: adjustedPadTop,
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

          let gridColsClass = 'grid-cols-1';
          let gridStyle: React.CSSProperties = {};

          if (layout === '2-col') {
            gridColsClass = 'grid-cols-1 lg:grid-cols-2';
          } else if (layout === '3-col') {
            gridColsClass = 'grid-cols-1 lg:grid-cols-3';
          } else if (layout === '4-col') {
            gridColsClass = 'grid-cols-1 lg:grid-cols-4';
          } else if (layout === 'grid') {
            gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
          }

          return (
            <section
              key={section.id}
              id={section.id}
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
                    backgroundColor: sectionProps.overlayType === 'gradient' ? undefined : overlayCol,
                    backgroundImage: sectionProps.overlayType === 'gradient'
                      ? `linear-gradient(${sectionProps.overlayGradientAngle ?? 135}deg, ${sectionProps.overlayGradientFrom || '#000000'}, ${sectionProps.overlayGradientTo || '#000000'})`
                      : undefined,
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
                  className={cn("w-full grid", gridColsClass, colGapClass, alignClass)}
                  style={layout === 'grid' ? gridStyle : undefined}
                >
                  {columnsBlocks.map((colBlocks, colIdx) => (
                    <div key={colIdx} className="flex-1 flex flex-col gap-4">
                      {colBlocks.map((block) => (
                        <AnimatedBlock key={block.id} block={block} ctx={ctx} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </main>

      {/* ─── DYNAMIC FOOTER RENDERER ───────────────────────────────── */}
      {page.settings.showFooter !== false && (() => {
        if (footerSettings.preset === 'org') {
          return <Footer orgBranding={orgBranding} className="w-full" />;
        }

        const address = footerSettings.overrideOrg ? footerSettings.address : orgBranding?.address;
        const email = footerSettings.overrideOrg ? footerSettings.email : orgBranding?.email;
        const phone = footerSettings.overrideOrg ? footerSettings.phone : orgBranding?.phone;
        const website = footerSettings.overrideOrg ? footerSettings.website : orgBranding?.website;
        const copyright = footerSettings.overrideOrg ? footerSettings.copyrightText : `Copyright © ${new Date().getFullYear()} ${orgBranding?.name || 'SmartSapp'}. All rights reserved.`;
        const socials = footerSettings.overrideOrg ? (footerSettings.socialLinks || {}) : (orgBranding?.socialLinks || {});

        const hasSocials = !!(socials.facebook || socials.twitter || socials.linkedin || socials.instagram || socials.youtube);

        return (
          <footer className="w-full bg-[#0A1427] text-white border-t border-border/10">
            {footerSettings.preset === 'simple' && (
              <div className="max-w-4xl mx-auto px-6 py-8 text-center space-y-4">
                <span className="text-sm font-bold opacity-75">{orgBranding?.name || 'SmartSapp'}</span>
                <p className="text-[10px] text-slate-400">{copyright}</p>
              </div>
            )}

            {footerSettings.preset === 'minimal' && (
              <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold opacity-75">{orgBranding?.name || 'SmartSapp'}</span>
                  <p className="text-[10px] text-slate-400">{copyright}</p>
                </div>
                {hasSocials && (
                  <div className="flex items-center gap-4 text-slate-400">
                    {socials.facebook && <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Facebook className="h-4 w-4" /></a>}
                    {socials.twitter && <a href={socials.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Twitter className="h-4 w-4" /></a>}
                    {socials.linkedin && <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Linkedin className="h-4 w-4" /></a>}
                    {socials.instagram && <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Instagram className="h-4 w-4" /></a>}
                    {socials.youtube && <a href={socials.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Youtube className="h-4 w-4" /></a>}
                  </div>
                )}
              </div>
            )}

            {footerSettings.preset === 'social-heavy' && (
              <div className="max-w-4xl mx-auto px-6 py-10 text-center space-y-6">
                <span className="text-sm font-bold tracking-wider">{orgBranding?.name || 'SmartSapp'}</span>
                {hasSocials ? (
                  <div className="flex justify-center gap-6 text-slate-400">
                    {socials.facebook && <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Facebook className="h-5 w-5" /></a>}
                    {socials.twitter && <a href={socials.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Twitter className="h-5 w-5" /></a>}
                    {socials.linkedin && <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Linkedin className="h-5 w-5" /></a>}
                    {socials.instagram && <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Instagram className="h-5 w-5" /></a>}
                    {socials.youtube && <a href={socials.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Youtube className="h-5 w-5" /></a>}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No social links configured</p>
                )}
                <p className="text-[10px] text-slate-500 pt-4 border-t border-slate-800/30">{copyright}</p>
              </div>
            )}

            {footerSettings.preset === 'multi-column' && (
              <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                  <div className="space-y-3">
                    <span className="text-sm font-bold">{orgBranding?.name || 'SmartSapp'}</span>
                    <p className="text-[10px] text-slate-450">{copyright}</p>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-350">Quick Links</h5>
                    <div className="flex flex-col gap-1.5 text-[10px] text-slate-400">
                      <span>Home</span>
                      <span>Privacy Policy</span>
                      <span>Terms of Service</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-slate-450">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Contact</h5>
                    <div className="flex flex-col gap-1.5 text-[10px] items-center md:items-start">
                      {address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {address}</span>}
                      {email && <a href={`mailto:${email}`} className="flex items-center gap-1 hover:text-white transition-colors"><Mail className="h-3 w-3" /> {email}</a>}
                      {phone && <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-white transition-colors"><Phone className="h-3 w-3" /> {phone}</a>}
                      {website && <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white transition-colors"><Globe className="h-3 w-3" /> {website}</a>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </footer>
        );
      })()}

    </div>
  );
}
