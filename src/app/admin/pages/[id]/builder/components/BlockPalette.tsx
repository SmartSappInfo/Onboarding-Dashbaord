'use client';

import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { allBlocks } from '@/lib/page-builder/registry';
import type { PageBlockType } from '@/lib/types';
import '@/lib/page-builder/blocks'; // register all blocks

interface BlockPaletteProps {
    onAddBlock: (type: PageBlockType) => void;
    onAddSection: () => void;
}

const CATEGORY_ORDER = ['content', 'layout', 'data', 'embed'] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
    content: 'Content',
    layout: 'Layout',
    data: 'Data Display',
    embed: 'Embeds',
};

const BlockPalette = React.memo(function BlockPalette({ onAddBlock, onAddSection }: BlockPaletteProps) {
    const blocks = allBlocks();

    return (
        <div className="space-y-6">
            {CATEGORY_ORDER.map((category) => {
                const items = blocks.filter((b) => b.category === category);
                if (items.length === 0) return null;
                return (
                    <section key={category}>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{CATEGORY_LABEL[category]}</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {items.map((def) => {
                                const Icon = def.icon;
                                return (
                                    <div
                                        key={def.type}
                                        onClick={() => onAddBlock(def.type)}
                                        className="group/item border border-slate-700/50 rounded-xl p-3 bg-slate-800/40 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-200 active:scale-95"
                                    >
                                        <Icon className="w-5 h-5 text-slate-400 group-hover/item:text-emerald-400 transition-colors" />
                                        <span className="text-[10px] font-semibold text-slate-400 group-hover/item:text-slate-200 transition-colors">{def.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <section className="pt-4 border-t border-slate-700/50">
                <Button
                    onClick={onAddSection}
                    className="w-full h-10 rounded-xl border-dashed border-2 border-slate-600 hover:border-emerald-500 hover:text-emerald-400 transition-all bg-transparent text-slate-500 font-bold text-xs"
                    variant="outline"
                >
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Empty Section
                </Button>
            </section>
        </div>
    );
});

export default BlockPalette;
