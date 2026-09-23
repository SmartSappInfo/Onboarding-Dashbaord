/**
 * @fileoverview Command Palette (Cmd+K) for Portal Studio Visual Configurator.
 *
 * ARCHITECTURAL RATIONALE:
 * Enables power users and studio operators to rapidly search, navigate, and jump
 * directly to any of the 16 portal configuration tools without manual tab navigation.
 * Adheres to .agents/AGENTS.md guidelines:
 * - Minimum touch target >= 44px on mobile
 * - Zero `any` or `any[]` typing
 * - Clean everyday microcopy
 */

'use client';

import * as React from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Building2,
  Palette,
  Menu,
  LayoutGrid,
  Globe,
  FileText,
  GraduationCap,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Users,
  Award,
  CreditCard,
  Lock,
  BarChart3,
  Building,
  Save,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import {
  STUDIO_CATEGORIES,
  STUDIO_TABS,
  type StudioTabId,
  type StudioViewMode,
} from '@/lib/types/portal-studio';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Palette,
  Menu,
  LayoutGrid,
  Globe,
  FileText,
  GraduationCap,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Users,
  Award,
  CreditCard,
  Lock,
  BarChart3,
  Building,
};

export interface PortalStudioCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tabId: StudioTabId) => void;
  onSave: () => void;
  onSetViewMode: (mode: StudioViewMode) => void;
}

export function PortalStudioCommandPalette({
  isOpen,
  onClose,
  onSelectTab,
  onSave,
  onSetViewMode,
}: PortalStudioCommandPaletteProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <CommandDialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <CommandInput placeholder="Type a section or tool (e.g., Theme, Curriculums, Access, SEO)..." />
      <CommandList className="max-h-[380px] p-2">
        <CommandEmpty>No matching studio tools found.</CommandEmpty>

        {/* Quick Studio Actions */}
        <CommandGroup heading="Studio Actions">
          <CommandItem
            onSelect={() => {
              onSave();
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer min-h-[44px] text-xs font-semibold"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Save className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span>Save Portal Changes</span>
              <span className="text-[10px] text-muted-foreground font-normal">Commit draft adjustments to live database</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSetViewMode('split');
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer min-h-[44px] text-xs font-semibold"
          >
            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span>Switch to Split View</span>
              <span className="text-[10px] text-muted-foreground font-normal">Side-by-side editor and live preview</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSetViewMode('preview');
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer min-h-[44px] text-xs font-semibold"
          >
            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <Eye className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span>Switch to Full Preview</span>
              <span className="text-[10px] text-muted-foreground font-normal">Maximized live simulator canvas</span>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="my-2" />

        {/* Categories and Tools */}
        {STUDIO_CATEGORIES.map(category => (
          <CommandGroup key={category.id} heading={category.label}>
            {category.tabIds.map(tabId => {
              const tab = STUDIO_TABS[tabId];
              const IconComponent = ICON_MAP[tab.iconName] || LayoutGrid;

              return (
                <CommandItem
                  key={tab.id}
                  onSelect={() => {
                    onSelectTab(tab.id);
                    onClose();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer min-h-[44px] text-xs font-medium"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted/60 text-foreground flex items-center justify-center shrink-0">
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-semibold text-foreground">{tab.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                      {tab.description}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
