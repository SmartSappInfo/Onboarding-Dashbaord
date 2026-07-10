'use client';

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { 
  Settings2, PlusCircle, Check, Users, Compass, 
  ChevronDown, ChevronUp, Trash2, Plus, 
  Globe, Mail, Phone, MapPin, Search, Link2 
} from 'lucide-react';
import type { 
  CampaignPage, SeoConfig, CampaignPageStructure, 
  PageHeaderSettings, PageFooterSettings, HeaderNavItem 
} from '@/lib/types';
import { SeoSettingsCard } from '@/components/seo/SeoSettingsCard';

interface SettingsPanelProps {
    page: CampaignPage;
    onUpdateSettings: (updates: Partial<CampaignPage['settings']>) => void;
    onUpdateSeo: (updates: Partial<CampaignPage['seo']>) => void;
    structure: CampaignPageStructure;
    onUpdateHeader: (updates: Partial<PageHeaderSettings>) => void;
    onUpdateFooter: (updates: Partial<PageFooterSettings>) => void;
}

const SettingsPanel = React.memo(function SettingsPanel({ 
    page, 
    onUpdateSettings, 
    onUpdateSeo,
    structure,
    onUpdateHeader,
    onUpdateFooter
}: SettingsPanelProps) {
    // Accordion state
    const [openSection, setOpenSection] = useState<string>('behavior');

    // Retrieve parsed structures with clean defaults
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

    const footer: PageFooterSettings = structure.footer || {
        preset: 'org',
        overrideOrg: false
    };

    const toggleAccordion = useCallback((name: string) => {
        setOpenSection(prev => prev === name ? '' : name);
    }, []);

    // ─── Header nav items mutation helpers ─────────────────────────
    const handleAddNavItem = useCallback(() => {
        const newItem: HeaderNavItem = {
            id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            label: 'New Link',
            linkType: 'url',
            url: '#'
        };
        onUpdateHeader({
            navItems: [...header.navItems, newItem]
        });
    }, [header.navItems, onUpdateHeader]);

    const handleRemoveNavItem = useCallback((id: string) => {
        onUpdateHeader({
            navItems: header.navItems.filter(item => item.id !== id)
        });
    }, [header.navItems, onUpdateHeader]);

    const handleUpdateNavItem = useCallback((id: string, updates: Partial<HeaderNavItem>) => {
        onUpdateHeader({
            navItems: header.navItems.map(item => item.id === id ? { ...item, ...updates } : item)
        });
    }, [header.navItems, onUpdateHeader]);

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-16">
            
            {/* 1. Page Behavior */}
            <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleAccordion('behavior')}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/60 transition-colors text-left"
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                            <Settings2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-350 uppercase tracking-wider">Page Behavior</span>
                    </div>
                    {openSection === 'behavior' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {openSection === 'behavior' && (
                    <div className="p-4 bg-slate-950/30 border-t border-slate-700/30 space-y-4">
                        <ToggleRow label="Show Header" checked={page.settings.showHeader} onChange={(v) => onUpdateSettings({ showHeader: v })} />
                        <ToggleRow label="Show Footer" checked={page.settings.showFooter} onChange={(v) => onUpdateSettings({ showFooter: v })} />
                    </div>
                )}
            </div>

            {/* 4. SEO & Social Sharing */}
            <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleAccordion('seo')}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/60 transition-colors text-left"
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-500/10 rounded-lg">
                            <Link2 className="h-4 w-4 text-orange-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-350 uppercase tracking-wider">SEO & Social Sharing</span>
                    </div>
                    {openSection === 'seo' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {openSection === 'seo' && (
                    <div className="p-4 bg-slate-950/30 border-t border-slate-700/30">
                        <SeoSettingsCard
                            value={page.seo as SeoConfig}
                            onChange={(next) => onUpdateSeo(next)}
                            assetLabel="Cover Image"
                            assetImageUrl={page.seo.ogImageUrl}
                            contentTitle={page.name}
                            previewUrl={`smartsapp.com/p/${page.slug}`}
                            description="Configure how this page appears in search engines and when shared."
                        />
                    </div>
                )}
            </div>

            {/* 5. Custom Scripts */}
            <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleAccordion('scripts')}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/60 transition-colors text-left"
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-500/10 rounded-lg">
                            <PlusCircle className="h-4 w-4 text-orange-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-350 uppercase tracking-wider">Custom Scripts</span>
                    </div>
                    {openSection === 'scripts' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {openSection === 'scripts' && (
                    <div className="p-4 bg-slate-950/30 border-t border-slate-700/30 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Header Code (Inside &lt;head&gt;)</Label>
                            <textarea
                                value={page.settings.customHead || ''}
                                onChange={(e) => onUpdateSettings({ customHead: e.target.value })}
                                className="w-full h-24 p-2.5 text-[9px] font-mono bg-slate-950 text-emerald-400 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20"
                                placeholder="<!-- Analytics, tracking pixels, etc. -->"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Body Code (End of &lt;body&gt;)</Label>
                            <textarea
                                value={page.settings.customBody || ''}
                                onChange={(e) => onUpdateSettings({ customBody: e.target.value })}
                                className="w-full h-24 p-2.5 text-[9px] font-mono bg-slate-950 text-emerald-400 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20"
                                placeholder="<!-- Custom chat widgets, etc. -->"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 6. Info Row / Help */}
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 text-left space-y-3">
                <InfoRow text="Embedded Forms and Surveys handle their own data — the page tracks conversions indirectly." />
                <InfoRow text="Use the Triggers tab to configure automations, modals, and redirects." />
                <InfoRow text="Clicking the canvas Header or Footer automatically scrolls to and opens their settings drawers here!" />
            </div>
        </div>
    );
});

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
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

function InfoRow({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3 text-emerald-400" /></div>
            <p className="text-[10px] font-medium text-slate-400 leading-normal">{text}</p>
        </div>
    );
}

export default SettingsPanel;
