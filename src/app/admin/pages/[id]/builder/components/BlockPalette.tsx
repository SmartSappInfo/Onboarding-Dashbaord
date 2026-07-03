'use client';

import React, { useState, useMemo } from 'react';
import { 
    PlusCircle, Search, ChevronRight, Sparkles, Box, FileText, 
    GraduationCap, Megaphone, Layers, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { allBlocks } from '@/lib/page-builder/registry';
import type { PageBlockType } from '@/lib/types';
import '@/lib/page-builder/blocks'; // register all blocks
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BlockPaletteProps {
    readonly onAddBlock: (type: PageBlockType) => void;
    readonly onRequestBlock: (type: PageBlockType) => void;
    readonly onAddSection: () => void;
}

type EnterpriseCategory = 'basic' | 'forms' | 'smartsapp' | 'marketing' | 'ai' | 'advanced';

interface CategoryConfig {
    id: EnterpriseCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}
const CATEGORIES: CategoryConfig[] = [
    { id: 'basic', label: 'Basic Components', icon: Box, description: 'Fundamental design elements' },
    { id: 'marketing', label: 'Marketing Sections', icon: Megaphone, description: 'Conversion & campaign layouts' },
    { id: 'forms', label: 'Form Elements', icon: FileText, description: 'Inputs, verification and fields' },
    { id: 'smartsapp', label: 'App Components', icon: GraduationCap, description: 'African school & billing modules' },
    { id: 'ai', label: 'AI Intelligence', icon: Sparkles, description: 'Smart assistant prompt panels' },
    { id: 'advanced', label: 'Advanced Layouts', icon: Layers, description: 'Complex widgets & layouts' },
];
interface LibraryItem {
    type: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    category: EnterpriseCategory;
    hasVariants: boolean;
    isPlaceholder?: boolean;
    description?: string;
}

export default function BlockPalette({ onAddBlock, onRequestBlock, onAddSection }: BlockPaletteProps) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<EnterpriseCategory, boolean>>({
        basic: true,
        forms: false,
        smartsapp: false,
        marketing: false,
        ai: false,
        advanced: false,
    });

    const registeredBlocks = useMemo(() => allBlocks(), []);

    // Statically group blocks into the new enterprise experience taxonomy
    const allItems = useMemo<LibraryItem[]>(() => {
        const items: LibraryItem[] = [];

        // 1. Basic Items
        registeredBlocks.filter(b => ['text', 'divider', 'spacer', 'image', 'video'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'basic', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        // Basic Placeholders
        items.push({ type: 'ph_shape', label: 'Shape', icon: Box, category: 'basic', hasVariants: false, isPlaceholder: true, description: 'Insert custom SVGs or geometric shapes.' });

        // 2. Forms
        registeredBlocks.filter(b => ['form', 'survey', 'agreement'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'forms', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        // Forms Placeholders
        const formPlaceholders = [
            { label: 'Date Picker', desc: 'Date selection fields.' },
            { label: 'File Upload', desc: 'Secure document submissions.' },
            { label: 'Digital Signature', desc: 'African legally-binding consent.' },
            { label: 'OTP Code Validator', desc: 'SMS multi-factor validation.' },
            { label: 'Payment Node', desc: 'Mobile Money payments integrations.' },
        ];
        formPlaceholders.forEach(ph => {
            items.push({ type: `ph_form_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: FileText, category: 'forms', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        // 3. SmartSapp
        registeredBlocks.filter(b => ['qr', 'meeting'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'smartsapp', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        // SmartSapp Placeholders
        const schoolPlaceholders = [
            { label: 'Fee Summary', desc: 'School fees breakdown card.' },
            { label: 'Student ID Card', desc: 'Digital badge with avatar.' },
            { label: 'Timetable', desc: 'Visual classroom calendar schedules.' },
            { label: 'Invoice Summary', desc: 'Receipts list and balances.' },
            { label: 'Canteen Menu', desc: 'Daily dietary options.' },
        ];
        schoolPlaceholders.forEach(ph => {
            items.push({ type: `ph_ss_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: GraduationCap, category: 'smartsapp', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        // 4. Marketing
        registeredBlocks.filter(b => [
            'hero', 'video_hero', 'cta', 'countdown', 'testimonial', 'testimonial_grid',
            'app_download', 'logo_grid', 'stats', 'step_section', 'procedure_list', 'faq'
        ].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'marketing', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        items.push({ type: 'ph_pricing', label: 'Pricing Table', icon: Megaphone, category: 'marketing', hasVariants: false, isPlaceholder: true, description: 'Comparison tables for packages.' });

        // 5. AI Placeholders
        const aiPlaceholders = [
            { label: 'AI Chat Panel', desc: 'Smart Assistant floating console.' },
            { label: 'Prompt Box', desc: 'User text inputs with AI feedback.' },
            { label: 'Knowledge Base Search', desc: 'AI indexed document files library search.' },
            { label: 'Summary Card', desc: 'Summarizes client records.' },
        ];
        aiPlaceholders.forEach(ph => {
            items.push({ type: `ph_ai_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: Sparkles, category: 'ai', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        // 6. Advanced
        registeredBlocks.filter(b => ['container', 'columns', 'choice_cards', 'html'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'advanced', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        // Advanced Placeholders
        const advancedPlaceholders = [
            { label: 'Accordion Group', desc: 'Expandable collapsibles stacks.' },
            { label: 'Carousel Slider', desc: 'Swipeable slide layouts.' },
            { label: 'Modal Dialog', desc: 'Pop-ups triggered by clicks.' },
            { label: 'Data Grid', desc: 'Sortable tables datasets.' },
        ];
        advancedPlaceholders.forEach(ph => {
            items.push({ type: `ph_adv_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: Layers, category: 'advanced', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        return items;
    }, [registeredBlocks]);

    // Apply search filter
    const filteredItems = useMemo(() => {
        if (!searchQuery) return allItems;
        const q = searchQuery.toLowerCase();
        return allItems.filter(item => 
            item.label.toLowerCase().includes(q) || 
            item.category.toLowerCase().includes(q)
        );
    }, [allItems, searchQuery]);

    const toggleCategory = (cat: EnterpriseCategory) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat],
        }));
    };

    const handleItemClick = (item: LibraryItem) => {
        if (item.isPlaceholder) {
            toast({
                title: `${item.label} (Under Construction)`,
                description: item.description ?? "This dynamic widget is currently in development.",
            });
            return;
        }

        if (item.hasVariants) {
            onRequestBlock(item.type as PageBlockType);
        } else {
            onAddBlock(item.type as PageBlockType);
        }
    };

    return (
        <div className="space-y-4 flex flex-col h-full select-none text-slate-200">
            {/* Search input header */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search components..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </div>

            {/* Accordion List */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {CATEGORIES.map((cat) => {
                    const items = filteredItems.filter(item => item.category === cat.id);
                    if (items.length === 0) return null;

                    const isExpanded = expandedCategories[cat.id] || searchQuery.length > 0;
                    const Icon = cat.icon;

                    return (
                        <div key={cat.id} className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
                            {/* Accordion Trigger */}
                            <button
                                type="button"
                                onClick={() => toggleCategory(cat.id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/20 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-200">{cat.label}</h4>
                                        <p className="text-[9px] text-slate-500 font-semibold">{cat.description}</p>
                                    </div>
                                </div>
                                <ChevronRight 
                                    className={cn(
                                        "w-4 h-4 text-slate-500 transition-transform duration-200", 
                                        isExpanded && "rotate-90"
                                    )} 
                                />
                            </button>

                            {/* Accordion Content */}
                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                        className="overflow-hidden bg-slate-950/20 border-t border-slate-800/40"
                                    >
                                        <div className="grid grid-cols-2 gap-2 p-3">
                                            {items.map((item) => {
                                                const ItemIcon = item.icon;
                                                return (
                                                    <div
                                                        key={item.type}
                                                        onClick={() => handleItemClick(item)}
                                                        className={cn(
                                                            "group relative border border-slate-800/80 rounded-xl p-3 bg-slate-900/30 flex items-center justify-center flex-col gap-2 cursor-pointer transition-all duration-200 active:scale-95",
                                                            item.isPlaceholder 
                                                                ? "hover:border-slate-700/50 opacity-60 hover:opacity-90"
                                                                : "hover:border-emerald-500/50 hover:bg-emerald-500/5"
                                                        )}
                                                        title={item.description}
                                                    >
                                                        {item.hasVariants ? (
                                                            <span className="absolute top-1 right-1 text-[7px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-1 rounded select-none">
                                                                Presets
                                                            </span>
                                                        ) : null}
                                                        {item.isPlaceholder ? (
                                                            <span className="absolute top-1 right-1 text-[7px] font-black uppercase text-slate-400 bg-slate-800 px-1 rounded select-none">
                                                                Beta
                                                            </span>
                                                        ) : null}
                                                        <ItemIcon className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                                                        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors text-center">
                                                            {item.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Sticky bottom add section */}
            <section className="pt-2 border-t border-slate-800/60 shrink-0">
                <Button
                    onClick={onAddSection}
                    className="w-full h-10 rounded-xl border-dashed border-2 border-slate-800 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all bg-transparent text-slate-500 font-bold text-xs"
                    variant="outline"
                >
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Empty Section
                </Button>
            </section>
        </div>
    );
}
