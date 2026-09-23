'use client';

/**
 * Authentic Resource Vault & Content Catalog Preview Component
 *
 * Renders a pixel-accurate preview of `/portal/[slug]/content` inside the
 * Studio visual preview canvas, matching `PortalContentCatalogClient.tsx`.
 *
 * Strict Compliance:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Live reactive theming and responsive grid layout.
 * - Mobile ergonomics: >=44px touch targets.
 * - Dual Light/Dark token fidelity.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - Consume `activeColors` from `usePortalTheme()` for icon backgrounds and primary button styling.
 * - Use `text-[var(--portal-text)]` for headings to prevent contrast degradation in dark canvas simulations.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FolderArchive,
  Search,
  FileText,
  FileCode,
  Download,
  ArrowRight,
  BookOpen,
  Newspaper,
  Layers,
  Lock,
} from 'lucide-react';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import { getContrastRatio } from '@/lib/utils/portal-theme-generator';
import { usePortalTheme } from './PortalThemeProvider';
import { cn } from '@/lib/utils';
import type { PortalThemeConfig } from '@/lib/types/portal';

export interface PortalVaultPreviewProps {
  theme: PortalThemeConfig;
  radiusCss: string;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard' | '/content') => void;
}

const TYPE_FILTER_TABS = [
  { id: 'all', label: 'All Resources', icon: Layers },
  { id: 'resource', label: 'Worksheets & Downloads', icon: FolderArchive },
  { id: 'doc', label: 'Documentation & Guides', icon: FileCode },
  { id: 'article', label: 'Articles & Insights', icon: Newspaper },
  { id: 'template', label: 'Templates & Models', icon: FileText },
];

const SAMPLE_RESOURCES = [
  {
    id: 'res-1',
    title: '5 Automated WhatsApp Strategies to Eliminate Late Fee Payments',
    summary: 'How leading schools use automated schedule triggers to collect 90%+ tuition on time.',
    type: 'article',
    category: 'Finance Strategy',
    tags: ['tuition', 'whatsapp', 'billing'],
    isGated: false,
    readingTime: '3 min read',
  },
  {
    id: 'res-2',
    title: 'Module 1: Invoicing Automation Architecture & USSD Setup',
    summary: 'Step-by-step masterclass on linking school bank accounts and mobile money gateways.',
    type: 'lesson',
    category: 'Operations',
    tags: ['ussd', 'banking', 'automation'],
    isGated: true,
    readingTime: 'Knowledge Resource',
  },
  {
    id: 'res-3',
    title: 'Tuition Fee Recovery Spreadsheet Model (Auto-Formulas)',
    summary: 'Pre-built financial workbook for tracking student billing batches, arrears, and collection KPIs.',
    type: 'resource',
    category: 'Toolkits',
    tags: ['spreadsheet', 'excel', 'finance'],
    isGated: false,
    isDownload: true,
  },
];

export function PortalVaultPreview({
  theme,
  radiusCss,
  onNavigateRoute: _onNavigateRoute,
}: PortalVaultPreviewProps) {
  const [selectedTopic, setSelectedTopic] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const { activeColors } = usePortalTheme();

  const primaryBtnTextColor = React.useMemo(() => {
    return getContrastRatio(activeColors.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F172A';
  }, [activeColors.primary]);

  const primaryBtnStyle = React.useMemo(() => {
    const base = getPortalButtonInlineStyle(
      theme.ui?.buttonStyle,
      'var(--portal-primary, #3B82F6)',
      radiusCss
    );
    return { ...base, color: primaryBtnTextColor };
  }, [theme.ui?.buttonStyle, radiusCss, primaryBtnTextColor]);

  const filteredResources = React.useMemo(() => {
    return SAMPLE_RESOURCES.filter(item => {
      if (selectedTopic !== 'all') {
        if (selectedTopic === 'resource' && item.type !== 'resource') return false;
        if (selectedTopic === 'doc' && item.type !== 'doc') return false;
        if (selectedTopic === 'article' && item.type !== 'article') return false;
        if (selectedTopic === 'template' && item.type !== 'template') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.tags.some(t => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [selectedTopic, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* ── Banner Section ────────────────────────────────────────────── */}
      <div
        className="p-8 sm:p-10 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-3 relative overflow-hidden transition-colors"
        style={{ borderRadius: radiusCss }}
      >
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: 'var(--portal-primary, #3B82F6)' }}
        />

        <Badge
          variant="outline"
          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5"
          style={{ color: 'var(--portal-primary, #3B82F6)', borderColor: 'var(--portal-primary, #3B82F6)' }}
        >
          Digital Vault & Documentation
        </Badge>
        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[var(--portal-text)]"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          Resources, Guides & Toolkits
        </h1>
        <p className="text-sm text-[var(--portal-muted)] max-w-2xl leading-relaxed">
          Downloadable spreadsheet models, operational SOPs, administrative guides, and expert knowledge
          curated for your institution.
        </p>
      </div>

      {/* ── Filter Bar & Search Input ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-[var(--portal-border)] pb-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {TYPE_FILTER_TABS.map(tab => {
            const IconComp = tab.icon;
            const isActive = selectedTopic === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTopic(tab.id)}
                className={cn(
                  'min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                  isActive
                    ? 'text-white shadow-xs'
                    : 'text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)]'
                )}
                style={{
                  backgroundColor: isActive ? 'var(--portal-primary, #3B82F6)' : 'transparent',
                  borderRadius: radiusCss,
                }}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inline Keyword Filter */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by title, tags, or topic..."
            className="pl-9 pr-8 min-h-[44px] text-xs bg-[var(--portal-surface)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)] font-medium"
            style={{ borderRadius: radiusCss }}
          />
        </div>
      </div>

      {/* ── Resource Cards Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map(item => {
          const IconComp =
            item.type === 'article' ? Newspaper : item.type === 'lesson' ? BookOpen : FolderArchive;

          return (
            <Card
              key={item.id}
              className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.99] flex flex-col justify-between group cursor-pointer"
              style={{ borderRadius: radiusCss }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                    style={{ backgroundColor: 'var(--portal-primary, #3B82F6)', borderRadius: radiusCss }}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.isGated && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold text-amber-600 border-amber-500/30 gap-1 bg-amber-500/5"
                      >
                        <Lock className="w-3 h-3" /> Member
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-wider capitalize border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-text)] shadow-none"
                    >
                      {item.type}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {item.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium text-[var(--portal-muted)] bg-[var(--portal-bg)]/80 px-2 py-0.5 rounded-md border border-[var(--portal-border)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--portal-border)] flex items-center justify-between gap-2">
                {item.isDownload ? (
                  <span className="min-h-[44px] flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                    <Download className="w-3.5 h-3.5" /> Direct Download
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[var(--portal-muted)]">
                    {item.readingTime}
                  </span>
                )}

                <Button
                  size="sm"
                  className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs gap-1.5 active:scale-[0.97] transition-transform"
                  style={primaryBtnStyle}
                >
                  <span>Access</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
