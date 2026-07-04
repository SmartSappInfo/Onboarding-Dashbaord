'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Pipette } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPageTheme, CampaignPage } from '@/lib/types';

interface ThemePanelProps {
    page: CampaignPage;
    themes: CampaignPageTheme[];
    onApplyTheme: (themeId: string) => void;
    onUpdateOverride: (key: string, value: string) => void;
}

const ThemePanel = React.memo(function ThemePanel({ page, themes, onApplyTheme, onUpdateOverride }: ThemePanelProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Theme Selection */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg">
                        <Palette className="h-4 w-4 text-violet-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Theme</h4>
                </div>

                {themes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                        {themes.map(t => (
                            <div
                                key={t.id}
                                onClick={() => onApplyTheme(t.id)}
                                className={cn(
                                    "group p-3 rounded-xl border cursor-pointer transition-all duration-200",
                                    page.themeId === t.id
                                        ? "bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20"
                                        : "bg-slate-800/50 border-slate-700 hover:border-violet-500/20 hover:bg-slate-800"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 rounded-full border border-white/10 shadow-inner" style={{ backgroundColor: t.colors.primary }} />
                                        <div className="w-4 h-4 rounded-full border border-white/10 shadow-inner" style={{ backgroundColor: t.colors.accent }} />
                                        <div className="w-4 h-4 rounded-full border border-white/10 shadow-inner" style={{ backgroundColor: t.colors.background }} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-slate-100 transition-colors">{t.name}</span>
                                    {t.isSystem && <Badge variant="outline" className="text-[7px] h-4 bg-slate-900 border-slate-700 text-slate-500">SYSTEM</Badge>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                        <Palette className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-medium">No themes available</p>
                    </div>
                )}
            </section>

            {/* Page Theme Mode */}
            <section className="space-y-3 pt-4 border-t border-slate-700/50">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Page Theme Mode</Label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => onUpdateOverride('themeMode', 'light')}
                        className={cn(
                            "flex-1 py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-center",
                            (page.settings.themeOverrides?.themeMode || 'light') === 'light'
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-300"
                        )}
                    >
                        Light Mode
                    </button>
                    <button
                        type="button"
                        onClick={() => onUpdateOverride('themeMode', 'dark')}
                        className={cn(
                            "flex-1 py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-center",
                            page.settings.themeOverrides?.themeMode === 'dark'
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-300"
                        )}
                    >
                        Dark Mode
                    </button>
                </div>
            </section>

            {/* Color Overrides */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Pipette className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Color Overrides</h4>
                </div>

                <div className="space-y-3">
                    <ColorPicker label="Primary" value={page.settings.themeOverrides?.primary || ''} onChange={(v) => onUpdateOverride('primary', v)} />
                    <ColorPicker label="Secondary" value={page.settings.themeOverrides?.secondary || ''} onChange={(v) => onUpdateOverride('secondary', v)} />
                    <ColorPicker label="Background" value={page.settings.themeOverrides?.background || ''} onChange={(v) => onUpdateOverride('background', v)} />
                    <ColorPicker label="Accent" value={page.settings.themeOverrides?.accent || ''} onChange={(v) => onUpdateOverride('accent', v)} />
                </div>
            </section>

            {/* Typography Override */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Font Family</Label>
                <Select
                    value={page.settings.themeOverrides?.typography?.primaryFont || 'Inter'}
                    onValueChange={(val) => onUpdateOverride('typography', JSON.stringify({ primaryFont: val }))}
                >
                    <SelectTrigger className="h-8 text-[10px] font-semibold bg-slate-800 border-slate-700 rounded-lg text-slate-300">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                        {['Inter', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Satoshi', 'General Sans', 'Sora', 'Cabinet Grotesk', 'Manrope'].map(f => (
                            <SelectItem key={f} value={f} className="text-[10px]" style={{ fontFamily: f }}>{f}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </section>
        </div>
    );
});

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-3">
            <div className="relative">
                <input
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-700 cursor-pointer bg-transparent appearance-none [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0.5"
                />
            </div>
            <div className="flex-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</Label>
                <Input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                    className="h-7 text-[10px] bg-slate-800 border-slate-700 font-mono text-slate-300 rounded-lg focus:border-emerald-500/50"
                />
            </div>
        </div>
    );
}

export default ThemePanel;
