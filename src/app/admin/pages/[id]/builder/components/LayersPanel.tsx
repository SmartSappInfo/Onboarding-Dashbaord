'use client';

import React, { useState } from 'react';
import { 
    Folder, FolderOpen, Eye, EyeOff, Lock, Unlock, Trash2, 
    Copy, ArrowUp, ArrowDown, ChevronRight, ChevronDown, 
    Type, Image, Play, Settings, Layers, Box, Tag, Edit3, Check
} from 'lucide-react';
import type { CampaignPageVersion, PageSection, PageBlock } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LayersPanelProps {
    readonly version: CampaignPageVersion;
    readonly selectedBlockId: string | null;
    readonly selectedSectionId: string | null;
    readonly onSelectBlock: (id: string | null) => void;
    readonly onSelectSection: (id: string | null) => void;
    readonly onRemoveBlock: (id: string) => void;
    readonly onRemoveSection: (id: string) => void;
    readonly onDuplicateBlock: (id: string) => void;
    readonly onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
    readonly onUpdateSectionProps: (sectionId: string, props: Record<string, unknown>) => void;
    readonly onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    readonly onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
}

export default function LayersPanel({
    version,
    selectedBlockId,
    selectedSectionId,
    onSelectBlock,
    onSelectSection,
    onRemoveBlock,
    onRemoveSection,
    onDuplicateBlock,
    onUpdateBlockProps,
    onUpdateSectionProps,
    onMoveBlock,
    onMoveSection,
}: LayersPanelProps) {
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const startRename = (id: string, currentLabel: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingNodeId(id);
        setRenameValue(currentLabel);
    };

    const saveRename = (id: string, isSection: boolean, e?: React.FormEvent) => {
        e?.preventDefault();
        if (isSection) {
            onUpdateSectionProps(id, { customLabel: renameValue.trim() });
        } else {
            onUpdateBlockProps(id, { customLabel: renameValue.trim() });
        }
        setEditingNodeId(null);
    };

    // Helper to get matching Lucide icon for block types
    const getBlockIcon = (type: string) => {
        switch (type) {
            case 'text': return Type;
            case 'image': return Image;
            case 'video': return Play;
            case 'form':
            case 'survey': return Settings;
            case 'columns':
            case 'container': return Layers;
            default: return Box;
        }
    };

    // Recursive block tree renderer
    const renderBlockNode = (block: PageBlock, index: number, total: number, depth: number) => {
        const isSelected = selectedBlockId === block.id;
        const isExpanded = expandedNodes[block.id] ?? true;
        const hasChildren = block.blocks && block.blocks.length > 0;
        const isHidden = !!block.props.hidden;
        const isLocked = !!block.props.locked;
        
        const customLabel = (block.props.customLabel as string) || '';
        const displayName = customLabel || block.type.charAt(0).toUpperCase() + block.type.slice(1);
        const IconComponent = getBlockIcon(block.type);

        return (
            <div key={block.id} className="select-none text-slate-300">
                {/* Node Row */}
                <div
                    onClick={() => {
                        onSelectSection(null);
                        onSelectBlock(block.id);
                    }}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    className={cn(
                        "group/layer flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-all text-xs font-medium border border-transparent mb-0.5",
                        isSelected 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                            : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
                    )}
                >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Expand Collapse Chevron */}
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={(e) => toggleExpand(block.id, e)}
                                className="p-0.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300"
                            >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                        ) : (
                            <span className="w-4 h-4 shrink-0" />
                        )}

                        <IconComponent className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                        {/* Editable Name Input */}
                        {editingNodeId === block.id ? (
                            <form 
                                onSubmit={(e) => saveRename(block.id, false, e)} 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 flex-1"
                            >
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    autoFocus
                                    className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none focus:border-emerald-500 flex-1"
                                />
                                <button type="submit" className="p-0.5 text-emerald-500 hover:bg-slate-800 rounded">
                                    <Check className="w-3 h-3" />
                                </button>
                            </form>
                        ) : (
                            <span className="truncate select-none font-semibold text-[11px]">
                                {displayName}
                            </span>
                        )}
                    </div>

                    {/* Actions Overlay Toolbar */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/layer:opacity-100 transition-opacity">
                        <button
                            type="button"
                            onClick={(e) => startRename(block.id, displayName, e)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                            title="Rename Layer"
                        >
                            <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdateBlockProps(block.id, { locked: !isLocked });
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                            title={isLocked ? "Unlock Layer" : "Lock Layer"}
                        >
                            {isLocked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdateBlockProps(block.id, { hidden: !isHidden });
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                            title={isHidden ? "Show Layer" : "Hide Layer"}
                        >
                            {isHidden ? <EyeOff className="w-3 h-3 text-red-500" /> : <Eye className="w-3 h-3" />}
                        </button>
                        {total > 1 && (
                            <>
                                <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, 'up'); }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                    title="Move Up"
                                >
                                    <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    disabled={index === total - 1}
                                    onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, 'down'); }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                    title="Move Down"
                                >
                                    <ArrowDown className="w-3 h-3" />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDuplicateBlock(block.id); }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                            title="Duplicate"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400"
                            title="Delete"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Recursive Children Blocks */}
                {hasChildren && isExpanded && (
                    <div className="space-y-0.5">
                        {block.blocks!.map((childBlock, idx) => 
                            renderBlockNode(childBlock, idx, block.blocks!.length, depth + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4 h-full flex flex-col select-none text-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 shrink-0">
                <span className="text-xs font-bold text-slate-400">Layers Hierarchy</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider bg-slate-900/50 border border-slate-800 rounded-md px-1.5 py-0.5 select-none">
                    Figma Mode
                </span>
            </div>

            {/* Tree Container */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1">
                {version.structureJson.sections.map((section, sectionIdx) => {
                    const isSectionSelected = selectedSectionId === section.id;
                    const isSectionExpanded = expandedNodes[section.id] ?? true;
                    const hasBlocks = section.blocks && section.blocks.length > 0;
                    const isSectionHidden = !!section.props.hidden;
                    const isSectionLocked = !!section.props.locked;

                    const customSecLabel = (section.props.customLabel as string) || '';
                    const sectionName = customSecLabel || `Section ${sectionIdx + 1}`;

                    return (
                        <div key={section.id} className="border border-slate-800/40 rounded-xl p-1 bg-slate-900/10">
                            {/* Section Header Layer Row */}
                            <div
                                onClick={() => {
                                    onSelectBlock(null);
                                    onSelectSection(section.id);
                                }}
                                className={cn(
                                    "group/sec flex items-center justify-between py-2 px-2.5 rounded-lg cursor-pointer transition-all text-xs font-semibold",
                                    isSectionSelected
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : "hover:bg-slate-800/30 text-slate-300"
                                )}
                            >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={(e) => toggleExpand(section.id, e)}
                                        className="p-0.5 rounded hover:bg-slate-700/30 text-slate-500"
                                    >
                                        {isSectionExpanded ? <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> : <Folder className="w-3.5 h-3.5 text-slate-400" />}
                                    </button>
                                    
                                    {editingNodeId === section.id ? (
                                        <form 
                                            onSubmit={(e) => saveRename(section.id, true, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1 flex-1"
                                        >
                                            <input
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                autoFocus
                                                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-emerald-500 flex-1"
                                            />
                                            <button type="submit" className="p-0.5 text-emerald-500 hover:bg-slate-800 rounded">
                                                <Check className="w-3 h-3" />
                                            </button>
                                        </form>
                                    ) : (
                                        <span className="truncate">
                                            {sectionName}
                                        </span>
                                    )}
                                </div>

                                {/* Section Action Overlay Buttons */}
                                <div className="flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={(e) => startRename(section.id, sectionName, e)}
                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                                        title="Rename Section"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateSectionProps(section.id, { locked: !isSectionLocked });
                                        }}
                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                                        title={isSectionLocked ? "Unlock Section" : "Lock Section"}
                                    >
                                        {isSectionLocked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateSectionProps(section.id, { hidden: !isSectionHidden });
                                        }}
                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200"
                                        title={isSectionHidden ? "Show Section" : "Hide Section"}
                                    >
                                        {isSectionHidden ? <EyeOff className="w-3 h-3 text-red-500" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    {version.structureJson.sections.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                disabled={sectionIdx === 0}
                                                onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, 'up'); }}
                                                className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                                title="Move Section Up"
                                            >
                                                <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={sectionIdx === version.structureJson.sections.length - 1}
                                                onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, 'down'); }}
                                                className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                                title="Move Section Down"
                                            >
                                                <ArrowDown className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onRemoveSection(section.id); }}
                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400"
                                        title="Delete Section"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* Section Blocks Tree */}
                            {hasBlocks && isSectionExpanded && (
                                <div className="mt-1 pl-2 pr-1 space-y-0.5 border-l border-slate-800/40 ml-4 pb-1">
                                    {section.blocks.map((block, blockIdx) => 
                                        renderBlockNode(block, blockIdx, section.blocks.length, 0)
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
