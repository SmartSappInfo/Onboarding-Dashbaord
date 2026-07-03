'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sliders, Layout, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnSettingsProps {
    readonly sectionId: string;
    readonly colIdx: number;
    readonly columnsProps: Record<string, unknown>;
    readonly onUpdate: (props: Record<string, unknown>) => void;
}

const INPUT_CLASS = 'h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50';

export const ColumnSettings = React.memo(function ColumnSettings({
    sectionId,
    colIdx,
    columnsProps,
    onUpdate,
}: ColumnSettingsProps) {
    const colProp = ((columnsProps[colIdx.toString()] || {}) as Record<string, unknown>);

    const handleChange = (key: string, value: unknown) => {
        onUpdate({ [key]: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 select-none text-slate-200 text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    Column Properties
                </Label>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-slate-950 border border-slate-850 px-2 py-0.5 rounded select-none w-max">
                    Column {colIdx + 1}
                </span>
            </div>

            {/* Layout & Alignments */}
            <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <AlignJustify className="w-3.5 h-3.5 text-emerald-400 rotate-90" />
                        Vertical Alignment
                    </Label>
                    <Select
                        value={(colProp.verticalAlign as string) || 'stretch'}
                        onValueChange={(v) => handleChange('verticalAlign', v)}
                    >
                        <SelectTrigger className={INPUT_CLASS}>
                            <SelectValue placeholder="Stretch" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                            <SelectItem value="stretch">Stretch</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Background Styling */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Background Color</Label>
                    <div className="flex gap-2 items-center">
                        <Input
                            type="color"
                            className="w-10 h-10 p-0 border border-slate-700 rounded-lg bg-slate-900 cursor-pointer shrink-0"
                            value={(colProp.backgroundColor as string) || '#ffffff'}
                            onChange={(e) => handleChange('backgroundColor', e.target.value)}
                        />
                        <Input
                            className={INPUT_CLASS}
                            placeholder="e.g. #ffffff or transparent"
                            value={(colProp.backgroundColor as string) || ''}
                            onChange={(e) => handleChange('backgroundColor', e.target.value)}
                        />
                    </div>
                </div>

                {/* Border Radius */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Border Radius (CSS)</Label>
                    <Input
                        className={INPUT_CLASS}
                        placeholder="e.g. 12px, 1rem"
                        value={(colProp.borderRadius as string) || ''}
                        onChange={(e) => handleChange('borderRadius', e.target.value)}
                    />
                </div>

                {/* Spacing / Paddings */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Layout className="w-3.5 h-3.5 text-emerald-400" />
                        Column Paddings
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black">Top Padding</span>
                            <Input
                                className={INPUT_CLASS}
                                placeholder="e.g. 16px"
                                value={(colProp.paddingTop as string) || ''}
                                onChange={(e) => handleChange('paddingTop', e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black">Bottom Padding</span>
                            <Input
                                className={INPUT_CLASS}
                                placeholder="e.g. 16px"
                                value={(colProp.paddingBottom as string) || ''}
                                onChange={(e) => handleChange('paddingBottom', e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black">Left Padding</span>
                            <Input
                                className={INPUT_CLASS}
                                placeholder="e.g. 16px"
                                value={(colProp.paddingLeft as string) || ''}
                                onChange={(e) => handleChange('paddingLeft', e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black">Right Padding</span>
                            <Input
                                className={INPUT_CLASS}
                                placeholder="e.g. 16px"
                                value={(colProp.paddingRight as string) || ''}
                                onChange={(e) => handleChange('paddingRight', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
