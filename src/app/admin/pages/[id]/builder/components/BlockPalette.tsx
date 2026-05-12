'use client';

import React from 'react';
import {
    Layout,
    Zap,
    Type,
    MousePointer2,
    ClipboardList,
    FileCheck,
    HelpCircle,
    PlusCircle,
    ImageIcon,
    Film,
    Minus,
    SeparatorHorizontal,
    Quote,
    BarChart3,
    Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PageBlockType } from '@/lib/types';

interface BlockPaletteProps {
    onAddBlock: (type: PageBlockType) => void;
    onAddSection: () => void;
}

const LAYOUT_BLOCKS = [
    { type: 'container' as PageBlockType, label: 'Container', icon: Layout },
    { type: 'columns' as PageBlockType, label: 'Columns', icon: null, custom: true },
];

const CONTENT_BLOCKS = [
    { type: 'hero' as PageBlockType, label: 'Hero', icon: Zap },
    { type: 'text' as PageBlockType, label: 'Rich Text', icon: Type },
    { type: 'image' as PageBlockType, label: 'Image', icon: ImageIcon },
    { type: 'video' as PageBlockType, label: 'Video', icon: Film },
    { type: 'cta' as PageBlockType, label: 'Button', icon: MousePointer2 },
    { type: 'spacer' as PageBlockType, label: 'Spacer', icon: SeparatorHorizontal },
    { type: 'divider' as PageBlockType, label: 'Divider', icon: Minus },
];

const DATA_BLOCKS = [
    { type: 'faq' as PageBlockType, label: 'FAQ', icon: HelpCircle },
    { type: 'testimonial' as PageBlockType, label: 'Testimonial', icon: Quote },
    { type: 'stats' as PageBlockType, label: 'Stats', icon: BarChart3 },
    { type: 'logo_grid' as PageBlockType, label: 'Logo Grid', icon: Grid3X3 },
];

const EMBED_BLOCKS = [
    { type: 'form' as PageBlockType, label: 'Form', icon: null, custom: true },
    { type: 'survey' as PageBlockType, label: 'Survey', icon: ClipboardList },
    { type: 'agreement' as PageBlockType, label: 'Agreement', icon: FileCheck },
    { type: 'html' as PageBlockType, label: 'Raw Code', icon: null, custom: true },
];

function BlockButton({ type, label, icon: Icon, custom, onAdd }: {
    type: PageBlockType;
    label: string;
    icon: any;
    custom?: boolean;
    onAdd: (type: PageBlockType) => void;
}) {
    return (
        <div
            onClick={() => onAdd(type)}
            className="group/item border border-slate-700/50 rounded-xl p-3 bg-slate-800/40 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-200 active:scale-95"
        >
            {Icon ? (
                <Icon className="w-5 h-5 text-slate-400 group-hover/item:text-emerald-400 transition-colors" />
            ) : custom && type === 'columns' ? (
                <div className="flex gap-1">
                    <div className="w-2 h-4 bg-slate-500 rounded-sm group-hover/item:bg-emerald-400 transition-colors" />
                    <div className="w-2 h-4 bg-slate-500 rounded-sm group-hover/item:bg-emerald-400 transition-colors" />
                </div>
            ) : custom && type === 'form' ? (
                <div className="h-5 w-12 bg-blue-500 rounded text-[6px] text-white flex items-center justify-center font-bold group-hover/item:bg-emerald-500 transition-colors">Submit</div>
            ) : custom && type === 'html' ? (
                <div className="flex gap-1 text-[7px] font-bold text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded group-hover/item:border-emerald-500/50 group-hover/item:text-emerald-400 transition-colors">&lt;/&gt;</div>
            ) : (
                <div className="w-5 h-5 bg-slate-600 rounded-sm" />
            )}
            <span className="text-[10px] font-semibold text-slate-400 group-hover/item:text-slate-200 transition-colors">{label}</span>
        </div>
    );
}

interface BlockDef {
    type: PageBlockType;
    label: string;
    icon: any;
    custom?: boolean;
}

function BlockSection({ title, blocks, onAdd }: { title: string; blocks: BlockDef[]; onAdd: (type: PageBlockType) => void }) {
    return (
        <section>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
            <div className="grid grid-cols-2 gap-2">
                {blocks.map(b => (
                    <BlockButton key={b.type} {...b} onAdd={onAdd} />
                ))}
            </div>
        </section>
    );
}

const BlockPalette = React.memo(function BlockPalette({ onAddBlock, onAddSection }: BlockPaletteProps) {
    return (
        <div className="space-y-6">
            <BlockSection title="Layouts" blocks={LAYOUT_BLOCKS} onAdd={onAddBlock} />
            <BlockSection title="Content" blocks={CONTENT_BLOCKS} onAdd={onAddBlock} />
            <BlockSection title="Data Display" blocks={DATA_BLOCKS} onAdd={onAddBlock} />
            <BlockSection title="Embeds" blocks={EMBED_BLOCKS} onAdd={onAddBlock} />

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
