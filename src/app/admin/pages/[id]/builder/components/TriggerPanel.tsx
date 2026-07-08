'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MousePointerClick, Play, PlusCircle, Loader2 } from 'lucide-react';
import type { PageTrigger, PageTriggerAction, CampaignPageVersion } from '@/lib/types';

interface TriggerPanelProps {
    triggers: PageTrigger[];
    version: CampaignPageVersion | null;
    automations: any[];
    surveys: any[];
    forms: any[];
    loadingResources: boolean;
    onAddTrigger: () => void;
    onUpdateTrigger: (id: string, updates: Partial<PageTrigger>) => void;
    onRemoveTrigger: (id: string) => void;
    onAddAction: (triggerId: string) => void;
    onUpdateAction: (triggerId: string, actionId: string, updates: Partial<PageTriggerAction>) => void;
    onRemoveAction: (triggerId: string, actionId: string) => void;
}

const TriggerPanel = React.memo(function TriggerPanel({
    triggers, version, automations, surveys, forms, loadingResources,
    onAddTrigger, onUpdateTrigger, onRemoveTrigger, onAddAction, onUpdateAction, onRemoveAction
}: TriggerPanelProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <section className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                            <MousePointerClick className="h-4 w-4 text-emerald-400" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Interactions</h4>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onAddTrigger} className="h-7 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10">
                        + Add
                    </Button>
                </div>

                <div className="space-y-3">
                    {triggers.length === 0 ? (
                        <div className="text-center py-8 px-4 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/50">
                            <MousePointerClick className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-[10px] text-slate-500 font-medium">No triggers configured yet.</p>
                            <p className="text-[9px] text-slate-600 mt-1">Use triggers to open modals, run automations, or redirect on events.</p>
                        </div>
                    ) : (
                        triggers.map((trigger) => (
                            <div key={trigger.id} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 space-y-4 relative group">
                                <Button variant="ghost" size="sm" onClick={() => onRemoveTrigger(trigger.id)} className="absolute top-2 right-2 h-6 w-6 p-0 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</Button>

                                <Input value={trigger.name} onChange={(e) => onUpdateTrigger(trigger.id, { name: e.target.value })} className="h-8 text-[11px] font-bold bg-transparent border-none p-0 focus-visible:ring-0 text-slate-200" placeholder="Trigger name..." />

                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-bold text-slate-500 uppercase">When This Happens</Label>
                                    <Select value={trigger.event} onValueChange={(val: any) => onUpdateTrigger(trigger.id, { event: val })}>
                                        <SelectTrigger className="h-8 text-[10px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                            <SelectItem value="page_load" className="text-[10px]">Page Loaded</SelectItem>
                                            <SelectItem value="block_click" className="text-[10px]">Block Clicked</SelectItem>
                                            <SelectItem value="form_submitted" className="text-[10px]">Form Submitted</SelectItem>
                                            <SelectItem value="on_exit" className="text-[10px]">Intent to Exit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(trigger.event === 'block_click' || trigger.event === 'form_submitted') && (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-bold text-slate-500 uppercase">Target Block ID</Label>
                                        <Input placeholder="e.g. hero_btn_1" value={trigger.targetBlockId || ''} onChange={(e) => onUpdateTrigger(trigger.id, { targetBlockId: e.target.value })} className="h-8 text-[10px] bg-slate-900 border-slate-700 font-semibold rounded-lg text-slate-300" />
                                    </div>
                                )}

                                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[9px] font-bold text-violet-400 uppercase">Do These Actions</Label>
                                        <Button variant="ghost" size="sm" onClick={() => onAddAction(trigger.id)} className="h-6 text-[9px] font-bold text-violet-400 p-0 px-2 hover:bg-violet-500/10">+ Action</Button>
                                    </div>

                                    {trigger.actions.map((action, aIdx) => (
                                        <div key={action.id} className="p-3 bg-violet-500/5 rounded-xl space-y-2 relative group/action border border-violet-500/10">
                                            {trigger.actions.length > 1 && (
                                                <Button variant="ghost" size="sm" onClick={() => onRemoveAction(trigger.id, action.id)} className="absolute top-1 right-1 h-5 w-5 p-0 text-slate-500 hover:text-red-400 opacity-0 group-hover/action:opacity-100 transition-opacity text-[10px]">×</Button>
                                            )}
                                            <div className="flex items-center gap-1 text-[8px] font-bold text-violet-400 uppercase">
                                                <Play className="h-2.5 w-2.5" /> Action {aIdx + 1}
                                            </div>

                                            <Select value={action.type} onValueChange={(val: any) => onUpdateAction(trigger.id, action.id, { type: val, config: {} })}>
                                                <SelectTrigger className="h-8 text-[10px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                    <SelectItem value="open_modal" className="text-[10px]">Open Modal</SelectItem>
                                                    <SelectItem value="trigger_automation" className="text-[10px]">Start Automation</SelectItem>
                                                    <SelectItem value="scroll_to" className="text-[10px]">Scroll to Section</SelectItem>
                                                    <SelectItem value="redirect" className="text-[10px]">Go to URL</SelectItem>
                                                    <SelectItem value="trigger_webhook" className="text-[10px]">Fire Webhook</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {action.type === 'open_modal' && (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Select value={action.config.modalType || ''} onValueChange={(val: any) => onUpdateAction(trigger.id, action.id, { config: { ...action.config, modalType: val } })}>
                                                            <SelectTrigger className="h-7 text-[9px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue placeholder="Type..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                                <SelectItem value="form" className="text-[9px]">Form</SelectItem>
                                                                <SelectItem value="survey" className="text-[9px]">Survey</SelectItem>
                                                                <SelectItem value="agreement" className="text-[9px]">Agreement</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Select value={action.config.targetId || ''} onValueChange={(val: any) => onUpdateAction(trigger.id, action.id, { config: { ...action.config, targetId: val } })}>
                                                            <SelectTrigger className="h-7 text-[9px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue placeholder="Target..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                                {action.config.modalType === 'survey' && surveys.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px]">{s.title}</SelectItem>)}
                                                                {action.config.modalType === 'form' && forms.map(f => <SelectItem key={f.id} value={f.id} className="text-[9px]">{f.internalName || f.title}</SelectItem>)}
                                                                {(!action.config.modalType || action.config.modalType === 'agreement') && <SelectItem value="none" disabled className="text-[9px]">Select type first</SelectItem>}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {action.config.modalType === 'survey' && (
                                                        <Select value={action.config.surveyResultMode || 'modal'} onValueChange={(val: any) => onUpdateAction(trigger.id, action.id, { config: { ...action.config, surveyResultMode: val } })}>
                                                            <SelectTrigger className="h-7 text-[9px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue placeholder="Result Display..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                                <SelectItem value="modal" className="text-[9px]">Show inside Modal</SelectItem>
                                                                <SelectItem value="parent" className="text-[9px]">Redirect parent page</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            )}

                                            {action.type === 'scroll_to' && (
                                                <Select value={action.config.targetId || ''} onValueChange={(val) => onUpdateAction(trigger.id, action.id, { config: { ...action.config, targetId: val } })}>
                                                    <SelectTrigger className="h-7 text-[9px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue placeholder="Section..." /></SelectTrigger>
                                                    <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                        {(version?.structureJson.sections || []).map((s, si) => (
                                                            <SelectItem key={s.id} value={s.id} className="text-[10px]">Section {si + 1}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {action.type === 'trigger_automation' && (
                                                <Select value={action.config.automationId || ''} onValueChange={(val: any) => onUpdateAction(trigger.id, action.id, { config: { automationId: val } })}>
                                                    <SelectTrigger className="h-7 text-[9px] font-semibold bg-slate-900 border-slate-700 rounded-lg text-slate-300"><SelectValue placeholder="Automation..." /></SelectTrigger>
                                                    <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                                                        {automations.map(a => <SelectItem key={a.id} value={a.id} className="text-[9px]">{a.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {(action.type === 'redirect' || action.type === 'trigger_webhook') && (
                                                <Input placeholder={action.type === 'redirect' ? 'https://...' : 'Webhook URL...'} value={action.config.url || ''} onChange={(e) => onUpdateAction(trigger.id, action.id, { config: { url: e.target.value } })} className="h-7 text-[9px] bg-slate-900 border-slate-700 font-semibold rounded-lg text-slate-300" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {loadingResources && <div className="flex items-center justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>}
            </section>
        </div>
    );
});

export default TriggerPanel;
