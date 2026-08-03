'use client';

import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { 
  Plus, Trash2, Mail, Phone, Globe, MapPin, Link as LinkIcon, Target 
} from 'lucide-react';
import type { 
  CampaignPage, PageHeaderSettings, PageFooterSettings, HeaderNavItem, CampaignPageStructure, BuilderResources, HeaderCtaButton
} from '@/lib/types';
import { getNormalizedHeaderButtons } from '@/lib/page-builder/resolve-theme';
import { ActionTargetModal } from './ActionTargetModal';
import { LinkPicker } from '@/app/admin/messaging/templates/components/link-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface HeaderSettingsControlProps {
  readonly page: CampaignPage;
  readonly structure: CampaignPageStructure;
  readonly resources: BuilderResources;
  readonly onUpdateHeader: (updates: Partial<PageHeaderSettings>) => void;
  readonly onUpdateSettings: (updates: Partial<CampaignPage['settings']>) => void;
}

export function HeaderSettingsControl({ 
  page, 
  structure, 
  resources,
  onUpdateHeader, 
  onUpdateSettings 
}: HeaderSettingsControlProps) {
  const header: PageHeaderSettings = structure.header || {
    preset: 'native',
    overlap: false,
    sticky: false,
    floating: false,
    showSearch: false,
    showCta: false,
    showPhone: false,
    navItems: []
  };

  const [activeTargetSelector, setActiveTargetSelector] = useState<{ type: 'button' | 'navItem' | 'subItem'; id: string; parentId?: string } | null>(null);
  const [openLinkPickerId, setOpenLinkPickerId] = useState<string | null>(null);

  const normalizedButtons = getNormalizedHeaderButtons(header);

  const handleSelectTarget = useCallback((targetId: string) => {
    if (!activeTargetSelector) return;
    if (activeTargetSelector.type === 'button') {
      const updated = normalizedButtons.map(btn => 
        btn.id === activeTargetSelector.id ? { ...btn, actionTargetId: targetId } : btn
      );
      onUpdateHeader({ buttons: updated });
    } else if (activeTargetSelector.type === 'subItem' && activeTargetSelector.parentId) {
      onUpdateHeader({
        navItems: (header.navItems || []).map(item => {
          if (item.id === activeTargetSelector.parentId) {
            const updatedChildren = (item.children || []).map(c => 
              c.id === activeTargetSelector.id ? { ...c, actionTargetId: targetId } : c
            );
            return { ...item, children: updatedChildren };
          }
          return item;
        })
      });
    } else {
      onUpdateHeader({
        navItems: (header.navItems || []).map(item =>
          item.id === activeTargetSelector.id ? { ...item, actionTargetId: targetId } : item
        )
      });
    }
    setActiveTargetSelector(null);
  }, [activeTargetSelector, normalizedButtons, header.navItems, onUpdateHeader]);

  const handleAddNavItem = useCallback(() => {
    const newItem: HeaderNavItem = {
      id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label: 'New Link',
      linkType: 'url',
      url: '#'
    };
    onUpdateHeader({
      navItems: [...(header.navItems || []), newItem]
    });
  }, [header.navItems, onUpdateHeader]);

  const handleRemoveNavItem = useCallback((id: string) => {
    onUpdateHeader({
      navItems: (header.navItems || []).filter(item => item.id !== id)
    });
  }, [header.navItems, onUpdateHeader]);

  const handleUpdateNavItem = useCallback((id: string, updates: Partial<HeaderNavItem>) => {
    onUpdateHeader({
      navItems: (header.navItems || []).map(item => item.id === id ? { ...item, ...updates } : item)
    });
  }, [header.navItems, onUpdateHeader]);

  return (
    <div className="space-y-4">
      <ToggleRow 
        label="Show Header" 
        checked={!!page.settings.showHeader} 
        onChange={(v) => onUpdateSettings({ showHeader: v })} 
      />

      {page.settings.showHeader && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-200 uppercase">Header Preset Layout</Label>
            <select
              value={header.preset}
              onChange={(e) => onUpdateHeader({ preset: e.target.value as PageHeaderSettings['preset'] })}
              className="w-full h-10 px-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-emerald-500/50"
            >
              <option value="native">Native (Logo Left, CTA Right)</option>
              <option value="minimal">Minimal (Logo Only, Centered)</option>
              <option value="full-nav">Full Navigation Menu</option>
              <option value="cta-only">CTA Button Only</option>
              <option value="search-nav">Search Bar + Navigation Links</option>
              <option value="card-nav">Card Nav (Animated Cards Menu)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <ToggleRow label="Overlap Hero" checked={!!header.overlap} onChange={(v) => onUpdateHeader({ overlap: v })} />
            <ToggleRow label="Sticky Top" checked={!!header.sticky} onChange={(v) => onUpdateHeader({ sticky: v })} />
            <ToggleRow label="Floating Capsule" checked={!!header.floating} onChange={(v) => onUpdateHeader({ floating: v })} />
            <ToggleRow label="Show Search" checked={!!header.showSearch} onChange={(v) => onUpdateHeader({ showSearch: v })} />
          </div>

          <div className="pt-2 border-t border-slate-800/40 space-y-3">
            <ToggleRow 
              label="Show CTA Buttons" 
              checked={!!header.showCta} 
              onChange={(v) => {
                onUpdateHeader({ 
                  showCta: v,
                  buttons: v ? (normalizedButtons.length > 0 ? normalizedButtons : [{
                    id: `cta-${Date.now()}`,
                    label: 'Action Button',
                    style: 'primary',
                    linkType: 'url',
                    url: '#',
                  }]) : []
                });
              }} 
            />

            {header.showCta && (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-slate-200 uppercase">Action Buttons</Label>
                  {normalizedButtons.length < 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newBtn: HeaderCtaButton = {
                          id: `cta-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                          label: `Button ${normalizedButtons.length + 1}`,
                          style: 'primary',
                          linkType: 'url',
                          url: '#',
                        };
                        onUpdateHeader({
                          buttons: [...normalizedButtons, newBtn]
                        });
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Button
                    </button>
                  )}
                </div>

                {normalizedButtons.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic text-center py-2">No buttons configured.</p>
                ) : (
                  <div className="space-y-3">
                    {normalizedButtons.map((btn, idx) => (
                      <div key={btn.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5 relative animate-in fade-in duration-205">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1.5">
                          <span className="text-[10px] font-semibold text-slate-300">Button #{idx + 1}: {btn.label || 'Untitled'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = normalizedButtons.filter(b => b.id !== btn.id);
                              onUpdateHeader({ 
                                buttons: updated,
                                showCta: updated.length > 0
                              });
                            }}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            aria-label="Remove Button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-slate-300 uppercase">Button Label</Label>
                            <input
                              type="text"
                              value={btn.label}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, label: e.target.value } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-2 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                              placeholder="Request Quote"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-slate-300 uppercase">Button Style</Label>
                            <select
                              value={btn.style || 'primary'}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, style: e.target.value as HeaderCtaButton['style'] } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-1.5 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                            >
                              <option value="primary">Solid Primary</option>
                              <option value="outline">Outline</option>
                              <option value="ghost">Ghost Link</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-slate-300 uppercase">Link Type</Label>
                            <select
                              value={btn.linkType || 'url'}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? {
                                  ...b,
                                  linkType: e.target.value as HeaderCtaButton['linkType'],
                                  url: '',
                                  targetSectionId: '',
                                  action: undefined,
                                  actionTargetId: undefined
                                } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-1.5 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                            >
                              <option value="url">URL Redirect</option>
                              <option value="scroll">Scroll to Section</option>
                              <option value="action">Trigger Page Action</option>
                            </select>
                          </div>

                          {btn.linkType === 'action' && (
                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Overlay Action</Label>
                              <select
                                value={btn.action || ''}
                                onChange={(e) => {
                                  const updated = normalizedButtons.map(b => b.id === btn.id ? {
                                    ...b,
                                    action: e.target.value as HeaderCtaButton['action'],
                                    actionTargetId: undefined
                                  } : b);
                                  onUpdateHeader({ buttons: updated });
                                }}
                                className="w-full h-8 px-1.5 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none"
                              >
                                <option value="">Select Action...</option>
                                <option value="receipt_request">Open Receipt Request</option>
                                <option value="open_modal_form">Open Form Modal</option>
                                <option value="open_modal_survey">Open Survey Modal</option>
                                <option value="open_modal_agreement">Open Agreement Modal</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {btn.linkType === 'url' && (
                          <div className="space-y-1 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Redirect URL Link</Label>
                              <Popover
                                open={openLinkPickerId === `btn-${btn.id}`}
                                onOpenChange={(open) => setOpenLinkPickerId(open ? `btn-${btn.id}` : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                  >
                                    <LinkIcon className="h-3 w-3" /> Select Target
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0 bg-slate-950 border border-slate-800 shadow-2xl" align="end">
                                  <LinkPicker
                                    onSelect={(selectedUrl) => {
                                      const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, url: selectedUrl } : b);
                                      onUpdateHeader({ buttons: updated });
                                      setOpenLinkPickerId(null);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <input
                              type="text"
                              value={btn.url || ''}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, url: e.target.value } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              placeholder="https://example.com or /surveys/sample"
                              className="w-full h-8 px-2 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                            />
                          </div>
                        )}

                        {btn.linkType === 'scroll' && (
                          <div className="space-y-1 animate-in fade-in duration-200">
                            <Label className="text-[8px] font-bold text-slate-300 uppercase">Target Section</Label>
                            <select
                              value={btn.targetSectionId || ''}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, targetSectionId: e.target.value } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-1.5 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none"
                            >
                              <option value="">Select a Section...</option>
                              {(structure.sections || []).map((sec, sIdx) => {
                                const heading = (sec.props as { heading?: string })?.heading || `Section ${sIdx + 1}`;
                                return <option key={sec.id} value={sec.id}>{heading}</option>;
                              })}
                            </select>
                          </div>
                        )}

                        {btn.linkType === 'action' && btn.action === 'open_modal_survey' && (
                          <div className="space-y-1 animate-in fade-in duration-200">
                            <Label className="text-[8px] font-bold text-slate-300 uppercase">Survey Result Display</Label>
                            <select
                              value={btn.surveyResultMode || 'modal'}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, surveyResultMode: e.target.value as HeaderCtaButton['surveyResultMode'] } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-1.5 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none"
                            >
                              <option value="modal">Show inside Modal</option>
                              <option value="parent">Redirect parent page</option>
                            </select>
                          </div>
                        )}

                        {/* Action Target Selector Trigger Button & Inline Resource Dropdown */}
                        {btn.linkType === 'action' && btn.action && ['open_modal_form', 'open_modal_survey', 'open_modal_agreement'].includes(btn.action) && (
                          <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <Label className="text-[8px] font-bold text-emerald-400 uppercase">
                                {btn.action === 'open_modal_form' ? 'Select Published Form' : btn.action === 'open_modal_survey' ? 'Select Published Survey' : 'Select Published Agreement'}
                              </Label>
                              <button
                                type="button"
                                onClick={() => setActiveTargetSelector({ type: 'button', id: btn.id })}
                                className="text-[8px] font-bold text-slate-400 hover:text-emerald-300 transition-colors"
                              >
                                Browse Thumbnails
                              </button>
                            </div>

                            <select
                              value={btn.actionTargetId || ''}
                              onChange={(e) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, actionTargetId: e.target.value } : b);
                                onUpdateHeader({ buttons: updated });
                              }}
                              className="w-full h-8 px-2 text-[10px] bg-slate-900 border border-emerald-500/40 rounded-md text-slate-100 font-semibold outline-none focus:border-emerald-400"
                            >
                              <option value="">
                                {btn.action === 'open_modal_form' ? 'Select Published Form...' : btn.action === 'open_modal_survey' ? 'Select Published Survey...' : 'Select Published Agreement...'}
                              </option>
                              {(btn.action === 'open_modal_form' ? resources.forms : btn.action === 'open_modal_survey' ? resources.surveys : resources.agreements).map((res) => (
                                <option key={res.id} value={res.id}>
                                  {res.title} {'status' in res && res.status ? `(${res.status})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Link Tracking & Parameter Forwarding Settings */}
                        <div className="pt-2 border-t border-slate-800/60 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-semibold text-slate-300 flex items-center gap-1.5">
                              <Target className="h-3.5 w-3.5 text-emerald-400" /> Link Tracking & UTM Forwarding
                            </Label>
                            <Switch 
                              checked={btn.enableTracking !== false} 
                              onCheckedChange={(checked) => {
                                const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, enableTracking: checked } : b);
                                onUpdateHeader({ buttons: updated });
                              }} 
                            />
                          </div>
                          {btn.enableTracking !== false && (
                            <div className="space-y-1 animate-in fade-in duration-200">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Custom Tracking Tag / ID (Optional)</Label>
                              <input
                                type="text"
                                value={btn.trackingId || ''}
                                onChange={(e) => {
                                  const updated = normalizedButtons.map(b => b.id === btn.id ? { ...b, trackingId: e.target.value } : b);
                                  onUpdateHeader({ buttons: updated });
                                }}
                                placeholder="e.g. cta_header_consultation"
                                className="w-full h-7 px-2 text-[10px] bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/40 space-y-3">
            <ToggleRow label="Show Phone Link" checked={!!header.showPhone} onChange={(v) => onUpdateHeader({ showPhone: v })} />
            {header.showPhone && (
              <div className="space-y-1 animate-in fade-in duration-300">
                <Label className="text-[9px] font-bold text-slate-200 uppercase">Phone Number</Label>
                <input
                  type="text"
                  value={header.phoneNumber || ''}
                  onChange={(e) => onUpdateHeader({ phoneNumber: e.target.value })}
                  placeholder="+1 (555) 019-2834"
                  className="w-full h-9 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                />
              </div>
            )}
          </div>

          {(header.preset === 'full-nav' || header.preset === 'search-nav' || header.preset === 'card-nav') && (
            <div className="pt-3 border-t border-slate-800/40 space-y-3">
              {/* Nav Alignment & Nav Style Presets */}
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-200 uppercase">Nav Link Alignment</Label>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => onUpdateHeader({ navAlignment: align })}
                        className={cn(
                          "flex-1 h-7 text-[9px] font-bold uppercase rounded-md transition-all capitalize flex items-center justify-center gap-1",
                          (header.navAlignment || 'center') === align
                            ? "bg-primary text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        )}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-200 uppercase">Nav Style Preset</Label>
                  <select
                    value={header.navStyle || 'underline_slide'}
                    onChange={(e) => onUpdateHeader({ navStyle: e.target.value as PageHeaderSettings['navStyle'] })}
                    className="w-full h-9 px-2 text-[10px] bg-slate-950 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
                  >
                    <option value="minimal">Minimal Text</option>
                    <option value="underline_slide">Underline Slide</option>
                    <option value="pill_tabs">Pill Tabs</option>
                    <option value="glass_cards">Glass Cards</option>
                    <option value="mega_menu">Mega Menu (Rich Dropdown)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-slate-200 uppercase">Menu Links & Dropdowns</Label>
                <button
                  type="button"
                  onClick={handleAddNavItem}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="h-3 w-3" /> Add Link
                </button>
              </div>

              {(!header.navItems || header.navItems.length === 0) ? (
                <p className="text-[10px] text-slate-500 italic text-center py-2">No links. Click 'Add Link' above.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {header.navItems.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2.5 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveNavItem(item.id)}
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-red-400 transition-colors"
                        aria-label="Remove Nav Item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-300 uppercase">Link Label</Label>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => handleUpdateNavItem(item.id, { label: e.target.value })}
                            className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-300 uppercase">Item Mode</Label>
                          <select
                            value={item.isDropdown ? 'dropdown' : 'single'}
                            onChange={(e) => {
                              const isDrop = e.target.value === 'dropdown';
                              handleUpdateNavItem(item.id, {
                                isDropdown: isDrop,
                                children: isDrop && (!item.children || item.children.length === 0) ? [{
                                  id: `sub-${Date.now()}-1`,
                                  label: 'Sub Item 1',
                                  subtitle: 'Overview description',
                                  icon: 'Briefcase',
                                  linkType: 'url',
                                  url: '#'
                                }] : item.children
                              });
                            }}
                            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          >
                            <option value="single">Single Link</option>
                            <option value="dropdown">Dropdown Menu</option>
                          </select>
                        </div>
                      </div>

                      {/* Single Link Settings */}
                      {!item.isDropdown && (
                        <div className="space-y-2 pt-1 border-t border-slate-800/60">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Target Type</Label>
                              <select
                                value={item.linkType}
                                onChange={(e) => handleUpdateNavItem(item.id, { 
                                  linkType: e.target.value as HeaderNavItem['linkType'],
                                  url: '#',
                                  targetSectionId: '',
                                  action: undefined
                                })}
                                className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                              >
                                <option value="url">URL Redirect</option>
                                <option value="scroll">Scroll to Section</option>
                                <option value="action">Trigger Page Action</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Badge (Optional)</Label>
                              <input
                                type="text"
                                value={item.badge || ''}
                                onChange={(e) => handleUpdateNavItem(item.id, { badge: e.target.value })}
                                placeholder="NEW"
                                className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 uppercase"
                              />
                            </div>
                          </div>

                          {item.linkType === 'url' && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-[8px] font-bold text-slate-300 uppercase">URL Link</Label>
                                <Popover
                                  open={openLinkPickerId === `nav-${item.id}`}
                                  onOpenChange={(open) => setOpenLinkPickerId(open ? `nav-${item.id}` : null)}
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                      <LinkIcon className="h-3 w-3" /> Select Target
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0 bg-slate-950 border border-slate-800 shadow-2xl" align="end">
                                    <LinkPicker
                                      onSelect={(selectedUrl) => {
                                        handleUpdateNavItem(item.id, { url: selectedUrl });
                                        setOpenLinkPickerId(null);
                                      }}
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <input
                                type="text"
                                value={item.url || ''}
                                onChange={(e) => handleUpdateNavItem(item.id, { url: e.target.value })}
                                placeholder="https://example.com or /p/survey-123"
                                className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                              />
                            </div>
                          )}

                          {item.linkType === 'scroll' && (
                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-slate-300 uppercase">Target Section</Label>
                              <select
                                value={item.targetSectionId || ''}
                                onChange={(e) => handleUpdateNavItem(item.id, { targetSectionId: e.target.value })}
                                className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                              >
                                <option value="">Select a Section...</option>
                                {(structure.sections || []).map((sec, sIdx) => {
                                  const heading = (sec.props as { heading?: string })?.heading || `Section ${sIdx + 1}`;
                                  return <option key={sec.id} value={sec.id}>{heading}</option>;
                                })}
                              </select>
                            </div>
                          )}

                          {item.linkType === 'action' && (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <Label className="text-[8px] font-bold text-slate-300 uppercase">Overlay Action</Label>
                                <select
                                  value={item.action || ''}
                                  onChange={(e) => handleUpdateNavItem(item.id, { 
                                    action: e.target.value as HeaderNavItem['action'],
                                    actionTargetId: undefined 
                                  })}
                                  className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                                >
                                  <option value="">Select Action...</option>
                                  <option value="receipt_request">Open Receipt Request Modal</option>
                                  <option value="open_modal_form">Open Form Modal</option>
                                  <option value="open_modal_survey">Open Survey Modal</option>
                                  <option value="open_modal_agreement">Open Agreement Modal</option>
                                </select>
                              </div>

                              {item.action && ['open_modal_form', 'open_modal_survey', 'open_modal_agreement'].includes(item.action) && (
                                <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[8px] font-bold text-emerald-400 uppercase">
                                      {item.action === 'open_modal_form' ? 'Select Published Form' : item.action === 'open_modal_survey' ? 'Select Published Survey' : 'Select Published Agreement'}
                                    </Label>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTargetSelector({ type: 'navItem', id: item.id })}
                                      className="text-[8px] font-bold text-slate-400 hover:text-emerald-300 transition-colors"
                                    >
                                      Browse Thumbnails
                                    </button>
                                  </div>

                                  <select
                                    value={item.actionTargetId || ''}
                                    onChange={(e) => handleUpdateNavItem(item.id, { actionTargetId: e.target.value })}
                                    className="w-full h-8 px-2 text-[10px] bg-slate-900 border border-emerald-500/40 rounded-md text-slate-100 font-semibold outline-none focus:border-emerald-400"
                                  >
                                    <option value="">
                                      {item.action === 'open_modal_form' ? 'Select Published Form...' : item.action === 'open_modal_survey' ? 'Select Published Survey...' : 'Select Published Agreement...'}
                                    </option>
                                    {(item.action === 'open_modal_form' ? resources.forms : item.action === 'open_modal_survey' ? resources.surveys : resources.agreements).map((res) => (
                                      <option key={res.id} value={res.id}>
                                        {res.title} {'status' in res && res.status ? `(${res.status})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dropdown Menu Sub-items Builder */}
                      {item.isDropdown && (
                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                              Dropdown Sub-Items ({(item.children || []).length})
                            </Label>
                            <button
                              type="button"
                              onClick={() => {
                                const newChild: HeaderNavItem = {
                                  id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                  label: 'New Option',
                                  subtitle: 'Brief description',
                                  icon: 'Briefcase',
                                  linkType: 'url',
                                  url: '#'
                                };
                                handleUpdateNavItem(item.id, {
                                  children: [...(item.children || []), newChild]
                                });
                              }}
                              className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add Sub-Item
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(item.children || []).map((child, cIdx) => (
                              <div key={child.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-md space-y-2 relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedChildren = (item.children || []).filter(c => c.id !== child.id);
                                    handleUpdateNavItem(item.id, { children: updatedChildren });
                                  }}
                                  className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                                  aria-label="Remove Sub Item"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Title</Label>
                                    <input
                                      type="text"
                                      value={child.label}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, label: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      className="w-full h-7 px-2 text-[10px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Subtitle</Label>
                                    <input
                                      type="text"
                                      value={child.subtitle || ''}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, subtitle: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      placeholder="Description"
                                      className="w-full h-7 px-2 text-[10px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Icon</Label>
                                    <select
                                      value={child.icon || 'Briefcase'}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, icon: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      className="w-full h-7 px-1 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    >
                                      <option value="Briefcase">Briefcase</option>
                                      <option value="Search">Search</option>
                                      <option value="Grid">Grid</option>
                                      <option value="Sparkles">Sparkles</option>
                                      <option value="Folder">Folder</option>
                                      <option value="Code">Code</option>
                                      <option value="User">User</option>
                                      <option value="Phone">Phone</option>
                                      <option value="FileText">FileText</option>
                                      <option value="HelpCircle">HelpCircle</option>
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Badge</Label>
                                    <input
                                      type="text"
                                      value={child.badge || ''}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, badge: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      placeholder="PRO"
                                      className="w-full h-7 px-1.5 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200 uppercase"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Target Type</Label>
                                    <select
                                      value={child.linkType || 'url'}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { 
                                          ...c, 
                                          linkType: e.target.value as HeaderNavItem['linkType'],
                                          url: '#',
                                          targetSectionId: '',
                                          action: undefined,
                                          actionTargetId: undefined
                                        } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      className="w-full h-7 px-1 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    >
                                      <option value="url">URL Redirect</option>
                                      <option value="scroll">Scroll Section</option>
                                      <option value="action">Page Action</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Target Configuration for Sub-Item */}
                                {(child.linkType === 'url' || !child.linkType) && (
                                  <div className="space-y-1 pt-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[8px] font-bold text-slate-400 uppercase">URL Link</Label>
                                      <Popover
                                        open={openLinkPickerId === `sub-${child.id}`}
                                        onOpenChange={(open) => setOpenLinkPickerId(open ? `sub-${child.id}` : null)}
                                      >
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                          >
                                            <LinkIcon className="h-2.5 w-2.5" /> Select Target
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-0 bg-slate-950 border border-slate-800 shadow-2xl" align="end">
                                          <LinkPicker
                                            onSelect={(selectedUrl) => {
                                              const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, url: selectedUrl } : c);
                                              handleUpdateNavItem(item.id, { children: updatedChildren });
                                              setOpenLinkPickerId(null);
                                            }}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <input
                                      type="text"
                                      value={child.url || ''}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, url: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      placeholder="https://example.com or /p/slug"
                                      className="w-full h-7 px-2 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                )}

                                {child.linkType === 'scroll' && (
                                  <div className="space-y-1 pt-1">
                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Target Section</Label>
                                    <select
                                      value={child.targetSectionId || ''}
                                      onChange={(e) => {
                                        const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, targetSectionId: e.target.value } : c);
                                        handleUpdateNavItem(item.id, { children: updatedChildren });
                                      }}
                                      className="w-full h-7 px-1 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    >
                                      <option value="">Select a Section...</option>
                                      {(structure.sections || []).map((sec, sIdx) => {
                                        const heading = (sec.props as { heading?: string })?.heading || `Section ${sIdx + 1}`;
                                        return <option key={sec.id} value={sec.id}>{heading}</option>;
                                      })}
                                    </select>
                                  </div>
                                )}

                                {child.linkType === 'action' && (
                                  <div className="space-y-1.5 pt-1">
                                    <div className="space-y-1">
                                      <Label className="text-[8px] font-bold text-slate-400 uppercase">Overlay Action</Label>
                                      <select
                                        value={child.action || ''}
                                        onChange={(e) => {
                                          const updatedChildren = (item.children || []).map(c => c.id === child.id ? { 
                                            ...c, 
                                            action: e.target.value as HeaderNavItem['action'],
                                            actionTargetId: undefined
                                          } : c);
                                          handleUpdateNavItem(item.id, { children: updatedChildren });
                                        }}
                                        className="w-full h-7 px-1 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-200"
                                      >
                                        <option value="">Select Action...</option>
                                        <option value="receipt_request">Open Receipt Request Modal</option>
                                        <option value="open_modal_form">Open Form Modal</option>
                                        <option value="open_modal_survey">Open Survey Modal</option>
                                        <option value="open_modal_agreement">Open Agreement Modal</option>
                                      </select>
                                    </div>

                                    {child.action && ['open_modal_form', 'open_modal_survey', 'open_modal_agreement'].includes(child.action) && (
                                      <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-[8px] font-bold text-emerald-400 uppercase">
                                            {child.action === 'open_modal_form' ? 'Select Published Form' : child.action === 'open_modal_survey' ? 'Select Published Survey' : 'Select Published Agreement'}
                                          </Label>
                                          <button
                                            type="button"
                                            onClick={() => setActiveTargetSelector({ type: 'subItem', id: child.id, parentId: item.id })}
                                            className="text-[8px] font-bold text-slate-400 hover:text-emerald-300 transition-colors"
                                          >
                                            Browse
                                          </button>
                                        </div>

                                        <select
                                          value={child.actionTargetId || ''}
                                          onChange={(e) => {
                                            const updatedChildren = (item.children || []).map(c => c.id === child.id ? { ...c, actionTargetId: e.target.value } : c);
                                            handleUpdateNavItem(item.id, { children: updatedChildren });
                                          }}
                                          className="w-full h-7 px-2 text-[9px] bg-slate-900 border border-emerald-500/40 rounded text-slate-100 font-semibold outline-none focus:border-emerald-400"
                                        >
                                          <option value="">
                                            {child.action === 'open_modal_form' ? 'Select Published Form...' : child.action === 'open_modal_survey' ? 'Select Published Survey...' : 'Select Published Agreement...'}
                                          </option>
                                          {(child.action === 'open_modal_form' ? resources.forms : child.action === 'open_modal_survey' ? resources.surveys : resources.agreements).map((res) => (
                                            <option key={res.id} value={res.id}>
                                              {res.title} {'status' in res && res.status ? `(${res.status})` : ''}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTargetSelector && (
        <ActionTargetModal
          isOpen={true}
          onOpenChange={(open) => {
            if (!open) setActiveTargetSelector(null);
          }}
          onSelect={(action, targetId) => handleSelectTarget(targetId)}
          resources={resources}
          defaultTab={
            (() => {
              if (activeTargetSelector.type === 'button') {
                const btn = normalizedButtons.find(b => b.id === activeTargetSelector.id);
                return btn?.action === 'open_modal_form' ? 'form' : btn?.action === 'open_modal_survey' ? 'survey' : btn?.action === 'open_modal_agreement' ? 'agreement' : undefined;
              } else {
                const item = (header.navItems || []).find(i => i.id === activeTargetSelector.id);
                return item?.action === 'open_modal_form' ? 'form' : item?.action === 'open_modal_survey' ? 'survey' : item?.action === 'open_modal_agreement' ? 'agreement' : undefined;
              }
            })()
          }
        />
      )}
    </div>
  );
}

interface FooterSettingsControlProps {
  readonly page: CampaignPage;
  readonly structure: CampaignPageStructure;
  readonly onUpdateFooter: (updates: Partial<PageFooterSettings>) => void;
  readonly onUpdateSettings: (updates: Partial<CampaignPage['settings']>) => void;
}

export function FooterSettingsControl({ 
  page, 
  structure, 
  onUpdateFooter, 
  onUpdateSettings 
}: FooterSettingsControlProps) {
  const footer: PageFooterSettings = structure.footer || {
    preset: 'org',
    overrideOrg: false
  };

  return (
    <div className="space-y-4">
      <ToggleRow 
        label="Show Footer" 
        checked={!!page.settings.showFooter} 
        onChange={(v) => onUpdateSettings({ showFooter: v })} 
      />

      {page.settings.showFooter && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Footer Preset Style</Label>
            <select
              value={footer.preset}
              onChange={(e) => onUpdateFooter({ preset: e.target.value as PageFooterSettings['preset'] })}
              className="w-full h-10 px-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-emerald-500/50"
            >
              <option value="org">Use Organization Footer</option>
              <option value="simple">Simple Copyright Centered</option>
              <option value="multi-column">Multi-Column Navigation</option>
              <option value="social-heavy">Social Links Centered</option>
              <option value="minimal">Minimal Row Layout</option>
            </select>
          </div>

          {footer.preset !== 'org' && (
            <div className="space-y-3 pt-2">
              <ToggleRow 
                label="Override Organization Details" 
                checked={!!footer.overrideOrg} 
                onChange={(v) => onUpdateFooter({ overrideOrg: v })} 
              />

              {footer.overrideOrg && (
                <div className="space-y-3 pt-2 border-t border-slate-800/40 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Copyright Statement</Label>
                    <input
                      type="text"
                      value={footer.copyrightText || ''}
                      onChange={(e) => onUpdateFooter({ copyrightText: e.target.value })}
                      placeholder="Copyright © 2026 My Brand. All rights reserved."
                      className="w-full h-9 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-slate-500 uppercase"><Mail className="inline h-2.5 w-2.5 mr-1" /> Email Address</Label>
                      <input
                        type="email"
                        value={footer.email || ''}
                        onChange={(e) => onUpdateFooter({ email: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-slate-500 uppercase"><Phone className="inline h-2.5 w-2.5 mr-1" /> Phone Number</Label>
                      <input
                        type="text"
                        value={footer.phone || ''}
                        onChange={(e) => onUpdateFooter({ phone: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-slate-500 uppercase"><Globe className="inline h-2.5 w-2.5 mr-1" /> Website URL</Label>
                      <input
                        type="text"
                        value={footer.website || ''}
                        onChange={(e) => onUpdateFooter({ website: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-slate-500 uppercase"><MapPin className="inline h-2.5 w-2.5 mr-1" /> Office Address</Label>
                      <input
                        type="text"
                        value={footer.address || ''}
                        onChange={(e) => onUpdateFooter({ address: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/40 space-y-2">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Social Handles Overrides</Label>
                    <div className="space-y-1.5">
                      {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'].map((platform) => (
                        <div key={platform} className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 w-16 capitalize">{platform}</span>
                          <input
                            type="text"
                            value={(footer.socialLinks as Record<string, string>)?.[platform] || ''}
                            onChange={(e) => onUpdateFooter({
                              socialLinks: { ...(footer.socialLinks || {}), [platform]: e.target.value }
                            })}
                            className="flex-1 h-7 px-2 text-[10px] bg-slate-900 border border-slate-700 rounded-md text-slate-200 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl border border-slate-800/40">
      <Label className="text-[11px] font-semibold text-slate-300">{label}</Label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-all duration-200 relative ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
        aria-label={label}
      >
        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-200 shadow-sm ${checked ? 'left-[18px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}
