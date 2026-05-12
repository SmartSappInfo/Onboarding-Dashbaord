'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Globe, PlusCircle, Check, Users } from 'lucide-react';
import type { CampaignPage } from '@/lib/types';

interface SettingsPanelProps {
    page: CampaignPage;
    onUpdateSettings: (updates: Partial<CampaignPage['settings']>) => void;
    onUpdateSeo: (updates: Partial<CampaignPage['seo']>) => void;
}

const SettingsPanel = React.memo(function SettingsPanel({ page, onUpdateSettings, onUpdateSeo }: SettingsPanelProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Behavior */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Settings2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Page Behavior</h4>
                </div>
                <div className="space-y-4">
                    <ToggleRow label="Show Header" checked={page.settings.showHeader} onChange={(v) => onUpdateSettings({ showHeader: v })} />
                    <ToggleRow label="Show Footer" checked={page.settings.showFooter} onChange={(v) => onUpdateSettings({ showFooter: v })} />
                </div>
            </section>

            {/* SEO */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Globe className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">SEO & Search</h4>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Page Title</Label>
                        <Input
                            value={page.seo.title || ''}
                            onChange={(e) => onUpdateSeo({ title: e.target.value })}
                            className="h-8 text-[11px] font-semibold bg-slate-800 border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500/50"
                            placeholder="Search result title..."
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Meta Description</Label>
                        <textarea
                            value={page.seo.description || ''}
                            onChange={(e) => onUpdateSeo({ description: e.target.value })}
                            className="w-full min-h-[60px] p-2 text-[10px] font-medium bg-slate-800 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20 text-slate-300"
                            placeholder="Brief summary for search engines..."
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">OG Image URL</Label>
                        <Input
                            value={page.seo.ogImageUrl || ''}
                            onChange={(e) => onUpdateSeo({ ogImageUrl: e.target.value })}
                            className="h-8 text-[11px] font-semibold bg-slate-800 border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500/50"
                            placeholder="https://..."
                        />
                    </div>
                    <ToggleRow label="Hide from Search (noindex)" checked={page.seo.noIndex || false} onChange={(v) => onUpdateSeo({ noIndex: v })} />
                </div>
            </section>

            {/* Custom Scripts */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg">
                        <PlusCircle className="h-4 w-4 text-orange-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Custom Scripts</h4>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Header Code (Inside &lt;head&gt;)</Label>
                        <textarea
                            value={page.settings.customHead || ''}
                            onChange={(e) => onUpdateSettings({ customHead: e.target.value })}
                            className="w-full h-24 p-2 text-[9px] font-mono bg-slate-950 text-emerald-400 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20"
                            placeholder="<!-- Analytics, tracking pixels, etc. -->"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Body Code (End of &lt;body&gt;)</Label>
                        <textarea
                            value={page.settings.customBody || ''}
                            onChange={(e) => onUpdateSettings({ customBody: e.target.value })}
                            className="w-full h-24 p-2 text-[9px] font-mono bg-slate-950 text-emerald-400 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20"
                            placeholder="<!-- Custom chat widgets, etc. -->"
                        />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg">
                        <Users className="h-4 w-4 text-violet-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">How It Works</h4>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
                    <InfoRow text="Embedded Forms and Surveys handle their own data — the page tracks conversions indirectly." />
                    <InfoRow text="Use the Triggers tab to configure automations, modals, and redirects." />
                </div>
            </section>
        </div>
    );
});

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Label className="text-[11px] font-semibold text-slate-300">{label}</Label>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`w-9 h-5 rounded-full transition-all duration-200 relative ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-200 shadow-sm ${checked ? 'left-[18px]' : 'left-[3px]'}`} />
            </button>
        </div>
    );
}

function InfoRow({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3 text-white" /></div>
            <p className="text-[10px] font-medium text-slate-400 leading-normal">{text}</p>
        </div>
    );
}

export default SettingsPanel;
