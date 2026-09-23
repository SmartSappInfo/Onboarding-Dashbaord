'use client';

/**
 * {{Org_name}} Experience Platform — Instant Content Search Modal
 *
 * Full-text search dialog with keyboard shortcut (Cmd+K / Ctrl+K),
 * real-time autocomplete, category filters, and direct result navigation.
 * Fully optimized for crisp light and dark theme contrast.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePortalTheme } from './PortalThemeProvider';
import { resolvePortalThemeStyles } from '@/lib/utils/portal-theme-generator';
import {
  Search,
  FileText,
  Sparkles,
  FolderArchive,
  Globe,
  Share2,
  Video,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import { searchPortalContentAction } from '@/app/actions/content-actions';
import type { ContentSearchResult, ContentItemType } from '@/lib/types/content';

interface PortalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalSlug: string;
}

const TYPE_ICONS: Record<ContentItemType, React.ComponentType<{ className?: string }>> = {
  article: FileText,
  lesson: Sparkles,
  resource: FolderArchive,
  page: Globe,
  announcement: Share2,
  video: Video,
  file: FolderArchive,
  embed: Globe,
};

export function PortalSearchModal({
  open,
  onOpenChange,
  portalId,
  portalSlug,
}: PortalSearchModalProps) {
  const router = useRouter();
  const { mode, activeColors, theme } = usePortalTheme();

  const [queryText, setQueryText] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [results, setResults] = React.useState<ContentSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);

  // Compute resolved inline styles so Radix UI Dialog portal inherits theme variables cleanly
  const themeStyles = React.useMemo(
    () => resolvePortalThemeStyles(theme, mode),
    [theme, mode]
  );

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setQueryText('');
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
    }
  }, [open]);

  // Reset selected item index when results update
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Debounced search
  React.useEffect(() => {
    if (!queryText.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchPortalContentAction(portalId, queryText.trim(), {
        type: selectedType !== 'all' ? (selectedType as ContentItemType) : undefined,
      });

      if (res.success && res.data) {
        setResults(res.data);
      }
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [queryText, selectedType, portalId]);

  // Global Cmd+K keyboard shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelectResult = (itemUrl: string) => {
    onOpenChange(false);
    router.push(itemUrl);
  };

  // Keyboard navigation through results
  const handleKeyDownInResults = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < results.length) {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        handleSelectResult(`/portal/${portalSlug}/content/${selected.item.type}/${selected.item.slug}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-portal-theme={mode}
        style={themeStyles}
        showCloseButton={false}
        overlayClassName="bg-black/40 dark:bg-black/75 backdrop-blur-xs"
        className={cn(
          "max-w-2xl rounded-3xl p-0 overflow-hidden gap-0 border shadow-2xl transition-colors font-figtree",
          "bg-[var(--portal-surface,#ffffff)] dark:bg-[var(--portal-surface,#0f172a)] text-[var(--portal-text,#0f172a)] dark:text-slate-100 border-[var(--portal-border,#e2e8f0)] dark:border-slate-800",
          mode === 'dark' ? 'dark' : ''
        )}
        onKeyDown={handleKeyDownInResults}
      >
        <DialogHeader className="p-4 pb-3 border-b border-[var(--portal-border,#e2e8f0)] dark:border-slate-800/80 bg-[var(--portal-surface,#ffffff)] dark:bg-slate-900/90">
          {/* Accessible DialogTitle for screen readers satisfying WAI-ARIA */}
          <DialogTitle className="sr-only">Search Portal Content & Resources</DialogTitle>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center rounded-2xl bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800/60 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700/80 transition-all focus-within:border-[var(--portal-primary)] focus-within:ring-2 focus-within:ring-[var(--portal-primary)]/20 shadow-2xs">
              <Search className="absolute left-3.5 w-4 h-4 text-[var(--portal-muted,#64748b)] dark:text-slate-400 pointer-events-none" />
              <Input
                value={queryText}
                onChange={e => setQueryText(e.target.value)}
                placeholder="Type to search lessons, articles, documentation, or toolkits..."
                className="w-full pl-10 pr-10 h-11 rounded-2xl text-sm border-0 focus-visible:ring-0 shadow-none font-medium bg-transparent text-[var(--portal-text,#0f172a)] dark:text-slate-100 placeholder:text-[var(--portal-muted,#94a3b8)] dark:placeholder:text-slate-500"
                autoFocus
              />
              {queryText && (
                <button
                  type="button"
                  onClick={() => setQueryText('')}
                  className="absolute right-2.5 p-1 rounded-lg text-[var(--portal-muted,#64748b)] dark:text-slate-400 hover:text-[var(--portal-text,#0f172a)] dark:hover:text-white hover:bg-[var(--portal-surface,#ffffff)] dark:hover:bg-slate-700 transition-colors"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-2.5 h-11 rounded-xl text-xs font-semibold text-[var(--portal-muted,#64748b)] dark:text-slate-400 hover:text-[var(--portal-text,#0f172a)] dark:hover:text-white hover:bg-[var(--portal-bg,#f8fafc)] dark:hover:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700/80 transition-all shrink-0 flex items-center gap-1 active:scale-[0.97]"
              aria-label="Close search dialog"
            >
              <span>Esc</span>
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-3 px-0.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'article', label: 'Articles' },
              { id: 'page', label: 'Docs' },
              { id: 'lesson', label: 'Lessons' },
              { id: 'resource', label: 'Downloads' },
            ].map(t => {
              const isActive = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 active:scale-[0.97] min-h-[32px] sm:min-h-[28px] border",
                    isActive
                      ? "text-white shadow-xs border-transparent font-bold"
                      : "bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800/60 text-[var(--portal-muted,#64748b)] dark:text-slate-300 border-[var(--portal-border,#e2e8f0)] dark:border-slate-700/70 hover:text-[var(--portal-text,#0f172a)] dark:hover:text-white hover:bg-[var(--portal-surface,#ffffff)] dark:hover:bg-slate-700/70"
                  )}
                  style={{
                    backgroundColor: isActive ? (activeColors?.primary || 'var(--portal-primary, #3B82F6)') : undefined,
                    color: isActive ? '#ffffff' : undefined,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Results Body */}
        <div className="max-h-[380px] overflow-y-auto p-4 space-y-2 bg-[var(--portal-bg,#f8fafc)]/50 dark:bg-slate-950/40">
          {isSearching ? (
            <div className="py-12 text-center space-y-2.5">
              <Loader2
                className="w-6 h-6 animate-spin mx-auto"
                style={{ color: activeColors?.primary || '#3B82F6' }}
              />
              <p className="text-xs font-medium text-[var(--portal-muted,#64748b)] dark:text-slate-400">
                Searching portal knowledge base...
              </p>
            </div>
          ) : queryText.trim() === '' ? (
            <div className="py-12 text-center space-y-2">
              <div
                className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center bg-[var(--portal-surface,#ffffff)] dark:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 mb-2 shadow-2xs"
                style={{ color: activeColors?.primary || '#3B82F6' }}
              >
                <Search className="w-4 h-4" />
              </div>
              <p className="font-bold text-sm text-[var(--portal-text,#0f172a)] dark:text-slate-100">
                Instant Knowledge Search
              </p>
              <p className="max-w-xs mx-auto text-xs text-[var(--portal-muted,#64748b)] dark:text-slate-400 leading-relaxed">
                Type keywords to search across all portal documentation, masterclasses, and toolkits.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center bg-[var(--portal-surface,#ffffff)] dark:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 text-[var(--portal-muted,#64748b)] dark:text-slate-400 mb-2 shadow-2xs">
                <X className="w-4 h-4" />
              </div>
              <p className="font-bold text-sm text-[var(--portal-text,#0f172a)] dark:text-slate-100">
                No matching content found
              </p>
              <p className="max-w-xs mx-auto text-xs text-[var(--portal-muted,#64748b)] dark:text-slate-400 leading-relaxed">
                No content matching &quot;<strong className="text-[var(--portal-text,#0f172a)] dark:text-white">{queryText}</strong>&quot;. Try different keywords or categories.
              </p>
            </div>
          ) : (
            results.map(({ item, snippet, matchedFields: _matchedFields }, index) => {
              const IconComp = TYPE_ICONS[item.type] || FileText;
              const targetUrl = `/portal/${portalSlug}/content/${item.type}/${item.slug}`;
              const isItemFocused = selectedIndex === index;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectResult(targetUrl)}
                  className={cn(
                    "w-full p-3.5 rounded-2xl border transition-all text-left flex items-start justify-between gap-3 group active:scale-[0.98] shadow-2xs",
                    isItemFocused
                      ? "border-[var(--portal-primary)] bg-[var(--portal-surface,#ffffff)] dark:bg-slate-800 ring-2 ring-[var(--portal-primary)]/20"
                      : "border-[var(--portal-border,#e2e8f0)] dark:border-slate-800 bg-[var(--portal-surface,#ffffff)] dark:bg-slate-900/90 hover:border-[var(--portal-primary)] dark:hover:border-[var(--portal-primary)] hover:bg-[var(--portal-bg,#f8fafc)]/60 dark:hover:bg-slate-800/80"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: `${activeColors?.primary || '#3B82F6'}18`,
                        color: activeColors?.primary || '#3B82F6',
                      }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[var(--portal-text,#0f172a)] dark:text-slate-100 group-hover:text-[var(--portal-primary)] transition-colors truncate">
                          {item.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase font-bold px-1.5 py-0 border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800 text-[var(--portal-muted,#64748b)] dark:text-slate-300"
                        >
                          {item.type}
                        </Badge>
                      </div>

                      {snippet && (
                        <p className="text-[11px] text-[var(--portal-muted,#64748b)] dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {snippet}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className="w-4 h-4 text-[var(--portal-muted,#64748b)] dark:text-slate-400 group-hover:text-[var(--portal-primary)] shrink-0 transition-transform group-hover:translate-x-0.5 mt-1"
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2.5 border-t border-[var(--portal-border,#e2e8f0)] dark:border-slate-800/80 bg-[var(--portal-surface,#ffffff)] dark:bg-slate-900 flex items-center justify-between text-[11px] text-[var(--portal-muted,#64748b)] dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 font-mono text-[10px] text-[var(--portal-text,#0f172a)] dark:text-slate-300">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 font-mono text-[10px] text-[var(--portal-text,#0f172a)] dark:text-slate-300">↵</kbd> Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--portal-bg,#f8fafc)] dark:bg-slate-800 border border-[var(--portal-border,#e2e8f0)] dark:border-slate-700 font-mono text-[10px] text-[var(--portal-text,#0f172a)] dark:text-slate-300">ESC</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
