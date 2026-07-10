'use client';

import React, { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { 
  Plus, Trash2, Mail, Phone, Globe, MapPin 
} from 'lucide-react';
import type { 
  CampaignPage, PageHeaderSettings, PageFooterSettings, HeaderNavItem, CampaignPageStructure
} from '@/lib/types';

interface HeaderSettingsControlProps {
  readonly page: CampaignPage;
  readonly structure: CampaignPageStructure;
  readonly onUpdateHeader: (updates: Partial<PageHeaderSettings>) => void;
  readonly onUpdateSettings: (updates: Partial<CampaignPage['settings']>) => void;
}

export function HeaderSettingsControl({ 
  page, 
  structure, 
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
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Header Preset Layout</Label>
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
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <ToggleRow label="Overlap Hero" checked={!!header.overlap} onChange={(v) => onUpdateHeader({ overlap: v })} />
            <ToggleRow label="Sticky Top" checked={!!header.sticky} onChange={(v) => onUpdateHeader({ sticky: v })} />
            <ToggleRow label="Floating Capsule" checked={!!header.floating} onChange={(v) => onUpdateHeader({ floating: v })} />
            <ToggleRow label="Show Search" checked={!!header.showSearch} onChange={(v) => onUpdateHeader({ showSearch: v })} />
          </div>

          <div className="pt-2 border-t border-slate-800/40 space-y-3">
            <ToggleRow label="Show CTA Button" checked={!!header.showCta} onChange={(v) => onUpdateHeader({ showCta: v })} />
            {header.showCta && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase">Button Label</Label>
                  <input
                    type="text"
                    value={header.ctaText || ''}
                    onChange={(e) => onUpdateHeader({ ctaText: e.target.value })}
                    placeholder="Request Quote"
                    className="w-full h-9 px-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase">Button Link</Label>
                  <input
                    type="text"
                    value={header.ctaUrl || ''}
                    onChange={(e) => onUpdateHeader({ ctaUrl: e.target.value })}
                    placeholder="/apply"
                    className="w-full h-9 px-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/40 space-y-3">
            <ToggleRow label="Show Phone Link" checked={!!header.showPhone} onChange={(v) => onUpdateHeader({ showPhone: v })} />
            {header.showPhone && (
              <div className="space-y-1 animate-in fade-in duration-300">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Phone Number</Label>
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

          {(header.preset === 'full-nav' || header.preset === 'search-nav') && (
            <div className="pt-3 border-t border-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Menu Items</Label>
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
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {header.navItems.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveNavItem(item.id)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                        aria-label="Remove Nav Item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Link Text</Label>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => handleUpdateNavItem(item.id, { label: e.target.value })}
                            className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Target Type</Label>
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
                      </div>

                      {item.linkType === 'url' && (
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">URL Link</Label>
                          <input
                            type="text"
                            value={item.url || ''}
                            onChange={(e) => handleUpdateNavItem(item.id, { url: e.target.value })}
                            placeholder="https://example.com"
                            className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          />
                        </div>
                      )}

                      {item.linkType === 'scroll' && (
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Target Section</Label>
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
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Overlay Action</Label>
                          <select
                            value={item.action || ''}
                            onChange={(e) => handleUpdateNavItem(item.id, { action: e.target.value as HeaderNavItem['action'] })}
                            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          >
                            <option value="">Select Action...</option>
                            <option value="receipt_request">Open Receipt Request Modal</option>
                            <option value="open_modal_form">Open Form Modal</option>
                            <option value="open_modal_survey">Open Survey Modal</option>
                            <option value="open_modal_agreement">Open Agreement Modal</option>
                          </select>
                        </div>
                      )}

                      {item.linkType === 'action' && item.action === 'open_modal_survey' && (
                        <div className="space-y-1 animate-in fade-in duration-200">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Survey Result Display</Label>
                          <select
                            value={item.surveyResultMode || 'modal'}
                            onChange={(e) => handleUpdateNavItem(item.id, { surveyResultMode: e.target.value as HeaderNavItem['surveyResultMode'] })}
                            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200"
                          >
                            <option value="modal">Show inside Modal</option>
                            <option value="parent">Redirect parent page</option>
                          </select>
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
