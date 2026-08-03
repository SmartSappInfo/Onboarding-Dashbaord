/**
 * PURPOSE:
 * HeaderNavRenderer renders header navigation links with 5 swappable visual styles
 * (Minimal, Underline Slide, Pill Tabs, Glass Cards, Mega Menu), independent link alignment
 * (Left, Center, Right), rich nested dropdown popovers supporting subtitles, Lucide icons, and badges,
 * and a mobile-optimized hamburger drawer with expandable accordion sub-menus.
 *
 * CAUTION:
 * Debounce hover leave to prevent drop-down flicker when mouse moves diagonally across items.
 *
 * TESTABILITY:
 * Test style swapping, alignment updates, hover/click interactions, and mobile drawer toggles.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronDown, ArrowRight, ExternalLink, Briefcase, Search, Grid, 
  Sparkles, Folder, Code, User, Phone, FileText, HelpCircle, Layers, 
  Link as LinkIcon, Menu, X 
} from 'lucide-react';
import type { PageHeaderSettings, HeaderNavItem } from '@/lib/types';
import { cn } from '@/lib/utils';

// Lucide icon dictionary mapping for rich dropdown items
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  Search,
  Grid,
  Sparkles,
  Folder,
  Code,
  User,
  Phone,
  FileText,
  HelpCircle,
  Layers,
  Link: LinkIcon,
  ExternalLink,
};

export function renderNavItemIcon(iconName?: string, className: string = "h-4 w-4") {
  if (!iconName) return null;
  const IconComp = ICON_MAP[iconName] || LinkIcon;
  return <IconComp className={className} />;
}

export interface HeaderNavRendererProps {
  readonly headerSettings: PageHeaderSettings;
  readonly onNavItemClick: (item: HeaderNavItem) => void;
  readonly primaryColor?: string;
  readonly className?: string;
  readonly isEditMode?: boolean;
}

export function HeaderNavRenderer({
  headerSettings,
  onNavItemClick,
  primaryColor = '#3B5FFF',
  className,
  isEditMode = false,
}: HeaderNavRendererProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const navItems = headerSettings.navItems || [];
  const navAlignment = headerSettings.navAlignment || 'center';
  const navStyle = headerSettings.navStyle || 'underline_slide';

  // Alignment classes for desktop container
  const alignmentClass = 
    navAlignment === 'left' ? 'justify-start' :
    navAlignment === 'right' ? 'justify-end' :
    'justify-center';

  // Debounced mouse enter / leave for smooth dropdown interactions
  const handleMouseEnter = useCallback((itemId: string) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setActiveDropdownId(itemId);
  }, []);

  const handleMouseLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setActiveDropdownId(null);
    }, 120); // 120ms debounce buffer prevents flicker during diagonal cursor glide
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  if (navItems.length === 0) return null;

  return (
    <div className="w-full flex items-center">
      {/* ─── DESKTOP NAVIGATION ────────────────────────────────────────── */}
      <nav
        ref={dropdownRef}
        className={cn(
          "hidden md:flex items-center gap-1.5 lg:gap-3 text-xs font-semibold w-full",
          alignmentClass,
          className
        )}
        aria-label="Header Navigation"
      >
        {navItems.map((item) => {
          const hasChildren = (item.isDropdown || (item.children && item.children.length > 0));
          const isOpen = activeDropdownId === item.id;
          const children = item.children || [];

          return (
            <div
              key={item.id}
              className="relative group"
              onMouseEnter={() => hasChildren && handleMouseEnter(item.id)}
              onMouseLeave={() => hasChildren && handleMouseLeave()}
            >
              {/* Nav Main Button */}
              <button
                type="button"
                onClick={(e) => {
                  if (hasChildren) {
                    e.preventDefault();
                    setActiveDropdownId(isOpen ? null : item.id);
                  } else {
                    onNavItemClick(item);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 transition-all duration-200 cursor-pointer min-h-[44px] px-3.5 py-2 rounded-lg select-none",
                  
                  // Style Preset 1: Minimal Text
                  navStyle === 'minimal' && "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent",
                  
                  // Style Preset 2: Underline Slide (bottom-[-2px] & pb-1 prevents descender clipping on 'g', 'p', 'y')
                  navStyle === 'underline_slide' && "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white relative pb-1 after:content-[''] after:absolute after:bottom-[-2px] after:left-3.5 after:right-3.5 after:h-[2.5px] after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200 after:ease-out",
                  
                  // Style Preset 3: Pill Tabs
                  navStyle === 'pill_tabs' && "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-full px-4 py-2",
                  
                  // Style Preset 4: Glass Cards
                  navStyle === 'glass_cards' && "text-slate-700 dark:text-slate-200 bg-slate-900/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 hover:border-primary/50 shadow-sm backdrop-blur-md rounded-xl px-4 py-2",
                  
                  // Style Preset 5: Mega Menu
                  navStyle === 'mega_menu' && "text-slate-800 dark:text-slate-100 font-bold hover:text-primary transition-colors px-3.5 py-2 rounded-lg hover:bg-slate-100/60 dark:hover:bg-zinc-800/50",

                  isOpen && "text-primary dark:text-primary"
                )}
              >
                {renderNavItemIcon(item.icon, "h-4 w-4 text-primary shrink-0")}
                <span>{item.label}</span>

                {item.badge && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 leading-none">
                    {item.badge}
                  </span>
                )}

                {hasChildren && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ease-out",
                      isOpen && "rotate-180 text-primary"
                    )}
                  />
                )}
              </button>

              {/* Rich Dropdown Popover */}
              {hasChildren && (
                <div
                  className={cn(
                    "absolute top-full left-0 mt-2 z-50 transition-all duration-200 ease-out transform origin-top-left",
                    isOpen
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none",
                    navStyle === 'mega_menu' ? "w-80 lg:w-96" : "w-64"
                  )}
                >
                  <div
                    className={cn(
                      "p-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all",
                      "bg-white/95 dark:bg-zinc-950/95 border-slate-200 dark:border-zinc-800/80 text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {/* Mega Menu Layout vs Standard Dropdown */}
                    {navStyle === 'mega_menu' ? (
                      <div className="space-y-1 p-1">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                            {item.label} Options
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1 pt-1">
                          {children.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onNavItemClick(child);
                              }}
                              className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900/90 transition-all text-left group/child cursor-pointer min-h-[44px]"
                            >
                              <div
                                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-zinc-850 border border-slate-200/80 dark:border-zinc-800 group-hover/child:bg-primary group-hover/child:text-white transition-colors"
                                style={{ color: primaryColor }}
                              >
                                {renderNavItemIcon(child.icon, "h-4 w-4")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover/child:text-primary transition-colors truncate">
                                    {child.label}
                                  </span>
                                  {child.badge && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 uppercase shrink-0">
                                      {child.badge}
                                    </span>
                                  )}
                                </div>
                                {child.subtitle && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-normal">
                                    {child.subtitle}
                                  </p>
                                )}
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover/child:opacity-100 group-hover/child:translate-x-0.5 transition-all self-center shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Standard Dropdown List */
                      <div className="space-y-1 p-1">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => {
                              setActiveDropdownId(null);
                              onNavItemClick(child);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors text-left group/child cursor-pointer min-h-[44px]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {renderNavItemIcon(child.icon, "h-4 w-4 text-slate-400 group-hover/child:text-primary transition-colors shrink-0")}
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover/child:text-primary transition-colors block truncate">
                                  {child.label}
                                </span>
                                {child.subtitle && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate font-normal">
                                    {child.subtitle}
                                  </span>
                                )}
                              </div>
                            </div>

                            {child.badge ? (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase ml-2 shrink-0">
                                {child.badge}
                              </span>
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover/child:opacity-100 transition-opacity shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ─── MOBILE HAMBURGER TRIGGER ───────────────────────────────────── */}
      <div className="md:hidden flex items-center justify-end w-full">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-zinc-850 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ─── MOBILE DRAWER OVERLAY ──────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200 md:hidden">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Navigation Menu</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 transition-all cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Accordion Nav List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {navItems.map((item) => {
              const hasChildren = (item.isDropdown || (item.children && item.children.length > 0));
              const isAccordionOpen = !!openAccordions[item.id];
              const children = item.children || [];

              return (
                <div key={item.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasChildren) {
                        setOpenAccordions(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                      } else {
                        setMobileOpen(false);
                        onNavItemClick(item);
                      }
                    }}
                    className="w-full flex items-center justify-between p-3.5 min-h-[48px] text-left text-sm font-bold text-slate-100 hover:text-primary transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {renderNavItemIcon(item.icon, "h-4 w-4 text-primary shrink-0")}
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {hasChildren && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-slate-400 transition-transform duration-200",
                          isAccordionOpen && "rotate-180 text-primary"
                        )}
                      />
                    )}
                  </button>

                  {/* Accordion Sub-Items */}
                  {hasChildren && isAccordionOpen && (
                    <div className="p-2 pt-0 space-y-1 border-t border-zinc-800/60 bg-zinc-950/60">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            onNavItemClick(child);
                          }}
                          className="w-full flex items-center gap-3 p-3 min-h-[44px] rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-zinc-850 transition-colors text-left cursor-pointer"
                        >
                          {renderNavItemIcon(child.icon, "h-4 w-4 text-primary shrink-0")}
                          <div className="flex-1 min-w-0">
                            <span className="block truncate font-bold">{child.label}</span>
                            {child.subtitle && (
                              <span className="block text-[10px] text-slate-400 truncate font-normal">
                                {child.subtitle}
                              </span>
                            )}
                          </div>
                          {child.badge && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase">
                              {child.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
