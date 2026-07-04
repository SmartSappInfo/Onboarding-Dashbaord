'use client';

import React, { useState, useMemo } from 'react';
import { 
    PlusCircle, Search, ChevronRight, Sparkles, Box, FileText, 
    GraduationCap, Megaphone, Layers, FolderHeart 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { allBlocks } from '@/lib/page-builder/registry';
import type { PageBlockType, PageSectionTemplate } from '@/lib/types';
import '@/lib/page-builder/blocks'; // register all blocks
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BlockPaletteProps {
    readonly onAddBlock: (type: PageBlockType) => void;
    readonly onRequestBlock: (type: PageBlockType) => void;
    readonly onAddSection: () => void;
    readonly savedSections: PageSectionTemplate[];
    readonly onAddSectionFromTemplate: (template: PageSectionTemplate) => void;
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

const PREDEFINED_SECTIONS: Omit<PageSectionTemplate, 'workspaceId' | 'createdAt'>[] = [
  {
    id: 'sec-tpl-sales-video',
    organizationId: '',
    name: 'Sales Video Funnel Section',
    category: 'sales',
    structure: {
      id: 'sales-video-sec',
      type: 'section',
      props: {
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'sales-video-hero-blk',
          type: 'hero',
          props: {
            align: 'center',
            isVideoSales: true,
            title: 'Why do parents choose *other schools* over yours?',
            subtitle: 'Watch this short video to find out.',
            videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            secondaryTitle: 'Want to make your school the _preferred choice_ for parents in one term?',
            secondarySubtitle: 'Book a FREE 30-minutes consultation to see your personalized roadmap to complete the shift.',
            ctaText: 'Request Free Consultation Now',
            ctaUrl: '#consultation',
            bulletList: 'Personalized Roadmap, Complete the shift'
          }
        }
      ]
    }
  },
  {
    id: 'sec-tpl-faq',
    organizationId: '',
    name: 'FAQ Accordion Section',
    category: 'support',
    structure: {
      id: 'faq-sec',
      type: 'section',
      props: {
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'faq-title',
          type: 'title',
          props: {
            preset: 'section-heading',
            title: 'Frequently Asked Questions',
            subheading: 'Quick answers to common questions about roster validation and compliance checks.',
            alignment: 'center'
          }
        },
        {
          id: 'faq-accordion',
          type: 'faq',
          props: {
            items: [
              { id: '1', question: 'How secure is the automated roster validation?', answer: 'We employ state-of-the-art encrypted document vaults and automated verification checks that validate school profiles against official regional registries in under 2 minutes.' },
              { id: '2', question: 'What compliance standards does SmartSapp support?', answer: 'Our pipelines conform to federal education data privacy mandates and secure roster audits to ensure organizational safety at every level.' }
            ]
          }
        }
      ]
    }
  },
  {
    id: 'sec-tpl-testimonials',
    organizationId: '',
    name: 'Testimonials Section',
    category: 'marketing',
    structure: {
      id: 'testimonials-sec',
      type: 'section',
      props: {
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'testi-title',
          type: 'title',
          props: {
            preset: 'section-heading',
            title: 'Trusted by School Administrators',
            subheading: 'Hear from officials managing nominal registration processes across the country.',
            alignment: 'center'
          }
        },
        {
          id: 'testi-card-1',
          type: 'testimonial',
          props: {
            quote: 'This system automated our compliance workflows, cutting class roster approvals from weeks to minutes.',
            author: 'Amara Diop',
            role: 'Registrar, Academic Excellence Institute',
            avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'
          }
        }
      ]
    }
  }
];

export default function BlockPalette({ 
    onAddBlock, 
    onRequestBlock, 
    onAddSection,
    savedSections,
    onAddSectionFromTemplate
}: BlockPaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activePaletteTab, setActivePaletteTab] = useState<'components' | 'templates'>('components');
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
        registeredBlocks.filter(b => ['title', 'text', 'divider', 'spacer', 'image', 'video'].includes(b.type)).forEach(b => {
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
            items.push({ type: `ph_school_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: GraduationCap, category: 'smartsapp', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        // 4. Marketing
        registeredBlocks.filter(b => ['hero', 'cta', 'testimonial', 'stats', 'faq', 'testimonial_grid', 'choice_cards', 'app_download', 'step_section', 'countdown'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'marketing', hasVariants: !!(b.variants && b.variants.length > 0) });
        });

        // 5. AI
        // AI Placeholders
        const aiPlaceholders = [
            { label: 'Translate Widget', desc: 'Translate student rosters dynamically.' },
            { label: 'Smart Assistant', desc: 'Interactive parent help helper.' },
            { label: 'Data Extractor', desc: 'Verify passport OCR uploads.' },
        ];
        aiPlaceholders.forEach(ph => {
            items.push({ type: `ph_ai_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: Sparkles, category: 'ai', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        // 6. Advanced
        registeredBlocks.filter(b => ['columns', 'html'].includes(b.type)).forEach(b => {
            items.push({ type: b.type, label: b.label, icon: b.icon, category: 'advanced', hasVariants: !!(b.variants && b.variants.length > 0) });
        });
        // Advanced Placeholders
        const advancedPlaceholders = [
            { label: 'Tabs Container', desc: 'Renders multiple tabs panels.' },
            { label: 'Map Embed', desc: 'Locates regional school districts.' },
        ];
        advancedPlaceholders.forEach(ph => {
            items.push({ type: `ph_adv_${ph.label.toLowerCase().replace(/\s+/g, '_')}`, label: ph.label, icon: Layers, category: 'advanced', hasVariants: false, isPlaceholder: true, description: ph.desc });
        });

        return items;
    }, [registeredBlocks]);

    const toggleCategory = (cat: EnterpriseCategory) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    // Filter items based on active search
    const filteredItems = useMemo(() => {
        if (!searchQuery) return allItems;
        return allItems.filter(item => 
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [searchQuery, allItems]);

    const handleSelectBlock = (type: string, isPlaceholder?: boolean) => {
        if (isPlaceholder) return;
        onAddBlock(type as PageBlockType);
    };

    const handleRequestBlock = (type: string, isPlaceholder?: boolean) => {
        if (isPlaceholder) return;
        onRequestBlock(type as PageBlockType);
    };

    // Filtering section templates matching search query
    const filteredPredefined = useMemo(() => {
        if (!searchQuery) return PREDEFINED_SECTIONS;
        return PREDEFINED_SECTIONS.filter(tpl => 
            tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tpl.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const filteredSaved = useMemo(() => {
        if (!searchQuery) return savedSections;
        return savedSections.filter(tpl => 
            tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tpl.category && tpl.category.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [searchQuery, savedSections]);

    return (
        <div className="flex flex-col h-full bg-slate-950/40 select-none text-left min-h-0">
            {/* Main Tabs Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border-b border-slate-800 shrink-0">
                <button
                    type="button"
                    onClick={() => setActivePaletteTab('components')}
                    className={cn(
                        "py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all text-center",
                        activePaletteTab === 'components'
                            ? "bg-slate-800 text-emerald-400"
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    Components
                </button>
                <button
                    type="button"
                    onClick={() => setActivePaletteTab('templates')}
                    className={cn(
                        "py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all text-center",
                        activePaletteTab === 'templates'
                            ? "bg-slate-800 text-emerald-400"
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    Templates
                </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-800/60 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <Input
                        aria-label="Search items"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={activePaletteTab === 'components' ? "Search components…" : "Search templates…"}
                        className="pl-9 h-10 rounded-xl bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    />
                </div>
            </div>

            {/* ─── TABS CONTENT ─── */}
            <AnimatePresence mode="wait">
                {activePaletteTab === 'components' ? (
                    <motion.div
                        key="components"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.15 }}
                        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                    >
                        {CATEGORIES.map((cat) => {
                            const catItems = filteredItems.filter(item => item.category === cat.id);
                            if (catItems.length === 0) return null;
                            const isExpanded = expandedCategories[cat.id];
                            const CatIcon = cat.icon;

                            return (
                                <div key={cat.id} className="border border-slate-850 rounded-xl bg-slate-900/20 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-900/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CatIcon className="w-4 h-4 text-slate-400" />
                                            <div className="flex flex-col text-left">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">{cat.label}</span>
                                                <span className="text-[8px] text-slate-500 font-bold">{cat.description}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("w-3.5 h-3.5 text-slate-500 transition-transform duration-200", isExpanded && "rotate-90")} />
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden border-t border-slate-800/40 bg-slate-950/20"
                                            >
                                                <div className="p-3 grid grid-cols-2 gap-2">
                                                    {catItems.map((item) => {
                                                        const ItemIcon = item.icon;
                                                        return (
                                                            <div
                                                                key={item.type}
                                                                onClick={() => handleSelectBlock(item.type, item.isPlaceholder)}
                                                                className={cn(
                                                                    "group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer select-none gap-1.5 min-h-[70px]",
                                                                    item.isPlaceholder 
                                                                        ? "border-slate-850 bg-slate-950/30 opacity-40 hover:opacity-60 cursor-not-allowed" 
                                                                        : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/30 active:scale-[0.97]"
                                                                )}
                                                            >
                                                                {item.hasVariants ? (
                                                                    <span className="absolute top-1 right-1 text-[7px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1 rounded select-none">
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
                                                                {!item.isPlaceholder && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleRequestBlock(item.type); }}
                                                                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-slate-800 border border-slate-700 items-center justify-center flex opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500 hover:text-white"
                                                                        title="Request specific placement"
                                                                        aria-label={`Request placement for ${item.label}`}
                                                                    >
                                                                        <PlusCircle className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
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
                    </motion.div>
                ) : (
                    <motion.div
                        key="templates"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0"
                    >
                        {/* 1. Predefined Presets */}
                        <div className="space-y-3.5">
                            <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Predefined Presets</Label>
                            {filteredPredefined.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-4 text-center">No matching predefined presets.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {filteredPredefined.map((tpl) => (
                                        <div key={tpl.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/20 transition-all flex flex-col gap-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-200">{tpl.name}</span>
                                                <Badge variant="outline" className="text-[8px] uppercase bg-slate-950 border-slate-850 text-slate-400 font-extrabold tracking-wider">{tpl.category}</Badge>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => onAddSectionFromTemplate(tpl as PageSectionTemplate)}
                                                className="w-full h-8.5 text-[10px] font-bold bg-slate-800 hover:bg-emerald-500 hover:text-white border-slate-700 hover:border-transparent text-slate-300 rounded-lg shadow-sm transition-colors duration-150"
                                            >
                                                Insert Section Preset
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. User Saved Sections */}
                        <div className="space-y-3.5 pt-2 border-t border-slate-900/60">
                            <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1 flex items-center gap-1">
                                <FolderHeart className="w-3.5 h-3.5 text-violet-400" />
                                Your Saved Custom Sections
                            </Label>
                            {filteredSaved.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-5 text-center bg-slate-900/20 border border-dashed border-slate-800 rounded-xl px-4">
                                    No saved custom sections. Hover a section in the editor and click "Save as Template" to build your custom library.
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {filteredSaved.map((tpl) => (
                                        <div key={tpl.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/20 transition-all flex flex-col gap-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-200">{tpl.name}</span>
                                                <Badge variant="outline" className="text-[8px] uppercase bg-slate-950 border-slate-850 text-slate-400 font-extrabold tracking-wider">{tpl.category || 'Custom'}</Badge>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => onAddSectionFromTemplate(tpl)}
                                                className="w-full h-8.5 text-[10px] font-bold bg-slate-800 hover:bg-emerald-500 hover:text-white border-slate-700 hover:border-transparent text-slate-300 rounded-lg shadow-sm transition-colors duration-150"
                                            >
                                                Insert Saved Section
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticky bottom add section */}
            <section className="p-4 border-t border-slate-800/60 shrink-0 bg-slate-950/40">
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
