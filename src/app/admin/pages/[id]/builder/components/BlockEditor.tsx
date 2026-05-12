'use client';

import React, { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, X, Settings2 } from 'lucide-react';
import type { PageBlock } from '@/lib/types';
import TipTapEditor from './TipTapEditor';

interface BlockEditorProps {
    block: PageBlock | null;
    sectionId: string | null;
    onUpdateProps: (blockId: string, props: Record<string, any>) => void;
    forms: any[];
    surveys: any[];
}

const BlockEditor = React.memo(function BlockEditor({ block, sectionId, onUpdateProps, forms, surveys }: BlockEditorProps) {
    if (!block) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60 py-20">
                <Settings2 className="w-8 h-8 text-slate-500" />
                <div>
                    <p className="text-sm font-semibold text-slate-300">No block selected</p>
                    <p className="text-[10px] text-slate-500 mt-1">Select a block on the canvas to edit its properties.</p>
                </div>
            </div>
        );
    }

    const update = (props: Record<string, any>) => onUpdateProps(block.id, props);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">{block.type} Block</h4>
                <Badge variant="outline" className="text-[9px] uppercase bg-slate-800 border-slate-700 text-slate-400">{block.id.split('_')[0]}</Badge>
            </div>

            <div className="space-y-4">
                {/* ─── Hero ─── */}
                {block.type === 'hero' && (
                    <>
                        <Field label="Headline">
                            <Input value={block.props.title || ''} onChange={(e) => update({ title: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Subtitle">
                            <textarea value={block.props.subtitle || ''} onChange={(e) => update({ subtitle: e.target.value })} className="w-full min-h-[80px] rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-semibold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" />
                        </Field>
                        <Field label="Background Image URL">
                            <div className="flex gap-2">
                                <Input placeholder="https://images.unsplash.com/..." value={block.props.imageUrl || ''} onChange={(e) => update({ imageUrl: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 flex-1 focus:border-emerald-500/50" />
                                {block.props.imageUrl && (
                                    <div className="h-10 w-10 rounded-lg border border-slate-700 overflow-hidden bg-slate-800 flex-shrink-0">
                                        <img src={block.props.imageUrl} alt="preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </Field>
                    </>
                )}

                {/* ─── Rich Text ─── */}
                {block.type === 'text' && (
                    <Field label="Content">
                        <TipTapEditor
                            content={block.props.content || ''}
                            onChange={(html) => update({ content: html })}
                        />
                    </Field>
                )}

                {/* ─── Image ─── */}
                {block.type === 'image' && (
                    <>
                        <Field label="Image URL">
                            <Input placeholder="https://..." value={block.props.src || ''} onChange={(e) => update({ src: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Alt Text">
                            <Input value={block.props.alt || ''} onChange={(e) => update({ alt: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Caption">
                            <Input value={block.props.caption || ''} onChange={(e) => update({ caption: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        {block.props.src && (
                            <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800">
                                <img src={block.props.src} alt={block.props.alt || 'preview'} className="w-full h-auto max-h-48 object-cover" />
                            </div>
                        )}
                    </>
                )}

                {/* ─── Video ─── */}
                {block.type === 'video' && (
                    <>
                        <Field label="Video URL">
                            <Input placeholder="https://youtube.com/watch?v=..." value={block.props.url || ''} onChange={(e) => update({ url: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Provider">
                            <Select value={block.props.provider || 'youtube'} onValueChange={(val) => update({ provider: val })}>
                                <SelectTrigger className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="vimeo">Vimeo</SelectItem>
                                    <SelectItem value="loom">Loom</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </>
                )}

                {/* ─── CTA ─── */}
                {block.type === 'cta' && (
                    <>
                        <Field label="Button Label">
                            <Input value={block.props.label || ''} onChange={(e) => update({ label: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Redirect URL">
                            <Input placeholder="https://..." value={block.props.url || ''} onChange={(e) => update({ url: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Button Style">
                            <Select value={block.props.variant || 'primary'} onValueChange={(val) => update({ variant: val })}>
                                <SelectTrigger className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                    <SelectItem value="primary" className="font-bold">Primary (Solid)</SelectItem>
                                    <SelectItem value="secondary">Secondary (Outline)</SelectItem>
                                    <SelectItem value="glass">Glassmorphism</SelectItem>
                                    <SelectItem value="glow">Glow Pulse</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </>
                )}

                {/* ─── Spacer ─── */}
                {block.type === 'spacer' && (
                    <Field label={`Height: ${block.props.height || 48}px`}>
                        <input
                            type="range" min={8} max={200} step={8}
                            value={block.props.height || 48}
                            onChange={(e) => update({ height: parseInt(e.target.value) })}
                            className="w-full accent-emerald-500"
                        />
                    </Field>
                )}

                {/* ─── Divider ─── */}
                {block.type === 'divider' && (
                    <Field label="Style">
                        <Select value={block.props.style || 'solid'} onValueChange={(val) => update({ style: val })}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                <SelectItem value="solid">Solid</SelectItem>
                                <SelectItem value="dashed">Dashed</SelectItem>
                                <SelectItem value="dotted">Dotted</SelectItem>
                                <SelectItem value="gradient">Gradient</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                )}

                {/* ─── Form ─── */}
                {block.type === 'form' && (
                    <Field label="Select Form">
                        <Select value={block.props.formId || ''} onValueChange={(val) => update({ formId: val })}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue placeholder="Choose a form..." /></SelectTrigger>
                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                {forms.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.internalName || f.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-[9px] text-slate-500 mt-1">Forms must be published to appear here.</p>
                    </Field>
                )}

                {/* ─── Survey ─── */}
                {block.type === 'survey' && (
                    <Field label="Select Survey">
                        <Select value={block.props.surveyId || ''} onValueChange={(val) => update({ surveyId: val })}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue placeholder="Choose a survey..." /></SelectTrigger>
                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                {surveys.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                )}

                {/* ─── FAQ ─── */}
                {block.type === 'faq' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">FAQ Items</Label>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => update({ items: [...(block.props.items || []), { id: Date.now().toString(), question: 'New Question', answer: 'New Answer' }] })}
                                className="h-7 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10"
                            >
                                <PlusCircle className="w-3 h-3 mr-1" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(block.props.items || []).map((item: any, idx: number) => (
                                <div key={item.id} className="p-3 bg-slate-800 rounded-xl border border-slate-700 relative group/faq">
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => update({ items: block.props.items.filter((i: any) => i.id !== item.id) })}
                                        className="absolute top-1 right-1 h-5 w-5 p-0 text-slate-500 hover:text-red-400 opacity-0 group-hover/faq:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                    <div className="space-y-2">
                                        <Input
                                            value={item.question}
                                            onChange={(e) => {
                                                const newItems = [...block.props.items];
                                                newItems[idx] = { ...newItems[idx], question: e.target.value };
                                                update({ items: newItems });
                                            }}
                                            className="h-8 text-[11px] font-bold bg-slate-900 border-slate-700 text-slate-200"
                                            placeholder="Question..."
                                        />
                                        <textarea
                                            value={item.answer}
                                            onChange={(e) => {
                                                const newItems = [...block.props.items];
                                                newItems[idx] = { ...newItems[idx], answer: e.target.value };
                                                update({ items: newItems });
                                            }}
                                            className="w-full min-h-[60px] p-2 text-[10px] bg-slate-900 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/20 text-slate-300"
                                            placeholder="Answer..."
                                        />
                                    </div>
                                </div>
                            ))}
                            {(!block.props.items || block.props.items.length === 0) && (
                                <p className="text-[10px] text-slate-500 text-center py-4 italic">No items added yet</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Testimonial ─── */}
                {block.type === 'testimonial' && (
                    <>
                        <Field label="Quote">
                            <textarea value={block.props.quote || ''} onChange={(e) => update({ quote: e.target.value })} className="w-full min-h-[80px] rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-semibold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" placeholder="What they said..." />
                        </Field>
                        <Field label="Author Name">
                            <Input value={block.props.author || ''} onChange={(e) => update({ author: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Role / Company">
                            <Input value={block.props.role || ''} onChange={(e) => update({ role: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" />
                        </Field>
                        <Field label="Avatar URL">
                            <Input value={block.props.avatarUrl || ''} onChange={(e) => update({ avatarUrl: e.target.value })} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50" placeholder="https://..." />
                        </Field>
                    </>
                )}

                {/* ─── Stats ─── */}
                {block.type === 'stats' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Stat Items</Label>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => update({ items: [...(block.props.items || []), { id: Date.now().toString(), value: '0', label: 'Stat' }] })}
                                className="h-7 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10"
                            >
                                <PlusCircle className="w-3 h-3 mr-1" /> Add Stat
                            </Button>
                        </div>
                        {(block.props.items || []).map((item: any, idx: number) => (
                            <div key={item.id} className="flex gap-2 items-center">
                                <Input value={item.value} onChange={(e) => { const newItems = [...block.props.items]; newItems[idx] = { ...newItems[idx], value: e.target.value }; update({ items: newItems }); }} className="h-8 w-20 text-xs bg-slate-800 border-slate-700 text-slate-200" placeholder="100+" />
                                <Input value={item.label} onChange={(e) => { const newItems = [...block.props.items]; newItems[idx] = { ...newItems[idx], label: e.target.value }; update({ items: newItems }); }} className="h-8 flex-1 text-xs bg-slate-800 border-slate-700 text-slate-200" placeholder="Label" />
                                <Button variant="ghost" size="sm" onClick={() => update({ items: block.props.items.filter((_: any, i: number) => i !== idx) })} className="h-8 w-8 p-0 text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── HTML ─── */}
                {block.type === 'html' && (
                    <>
                        <Field label="Raw HTML">
                            <textarea
                                value={block.props.html || ''} onChange={(e) => update({ html: e.target.value })}
                                placeholder="<div>\n  <h1>Custom Content</h1>\n</div>"
                                className="w-full min-h-[150px] rounded-xl bg-slate-900 border border-slate-700 p-3 text-[11px] font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            />
                        </Field>
                        <Field label="Custom CSS">
                            <textarea
                                value={block.props.css || ''} onChange={(e) => update({ css: e.target.value })}
                                placeholder=".custom-class {\n  color: red;\n}"
                                className="w-full min-h-[150px] rounded-xl bg-slate-900 border border-slate-700 p-3 text-[11px] font-mono text-violet-400 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                            />
                        </Field>
                    </>
                )}
            </div>
        </div>
    );
});

// ─── Helper ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">{label}</Label>
            {children}
        </div>
    );
}

export default BlockEditor;
