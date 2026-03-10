'use client';

import * as React from 'react';
import { 
    Layout, 
    Settings2, 
    MonitorPlay, 
    Check, 
    ArrowRight, 
    Loader2, 
    Save, 
    Database, 
    PlusCircle, 
    Eye, 
    Maximize2, 
    Minimize2, 
    Monitor, 
    Smartphone as PhoneIcon,
    Code,
    Sparkles,
    ChevronRight,
    FlaskConical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { MessageTemplate, MessageBlock, VariableDefinition, MessageStyle, School, Meeting, Survey, PDFForm } from '@/lib/types';
import { renderBlocksToHtml, resolveVariables } from '@/lib/messaging-utils';
import { SortableBlockItem, blockIcons } from './visual-block';
import { BlockInspector } from './block-inspector';
import { SimulationStudio } from './simulation-studio';
import { useToast } from '@/hooks/use-toast';
import TestDispatchDialog from '../../components/TestDispatchDialog';

interface TemplateWorkshopProps {
    initialTemplate?: MessageTemplate | null;
    variables: VariableDefinition[];
    styles: MessageStyle[];
    schools?: School[];
    meetings?: Meeting[];
    surveys?: Survey[];
    pdfs?: PDFForm[];
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}

export function TemplateWorkshop({
    initialTemplate,
    variables,
    styles,
    schools,
    meetings,
    surveys,
    pdfs,
    onSave,
    onCancel,
    isSaving
}: TemplateWorkshopProps) {
    const { toast } = useToast();
    const [step, setStep] = React.useState(1);
    const [editorMode, setEditorMode] = React.useState<'designer' | 'code'>('designer');
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = React.useState<'blocks' | 'tags' | 'properties'>('blocks');
    const [variablesWidth, setVariablesWidth] = React.useState(320);
    const [isResizing, setIsResizing] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);

    // Form State
    const [name, setName] = React.useState(initialTemplate?.name || '');
    const [category, setCategory] = React.useState(initialTemplate?.category || 'general');
    const [channel, setChannel] = React.useState(initialTemplate?.channel || 'email');
    const [subject, setSubject] = React.useState(initialTemplate?.subject || '');
    const [previewText, setPreviewText] = React.useState(initialTemplate?.previewText || '');
    const [body, setBody] = React.useState(initialTemplate?.body || '');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>(initialTemplate?.blocks || []);
    const [styleId, setStyleId] = React.useState(initialTemplate?.styleId || 'none');

    // Simulation State
    const [simEntity, setSimEntity] = React.useState('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);

    const sensors = useSensors(useSensor(PointerSensor));

    // Sync Designers
    React.useEffect(() => {
        if (channel === 'email' && editorMode === 'designer') {
            // Internal sync uses empty variables but we need to ensure formatting is consistent
            const html = renderBlocksToHtml(blocks, {});
            if (html !== body) setBody(html);
        }
    }, [blocks, channel, editorMode, body]);

    const handleAddBlock = (type: MessageBlock['type'], variant?: 'h1'|'h2'|'h3') => {
        const id = `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newBlock: MessageBlock = { id, type, title: '', content: '', variant, style: { textAlign: 'left', variant: 'default' } };
        if (type === 'list') { newBlock.listStyle = 'unordered'; newBlock.items = ['Item 1']; }
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(id);
        setSidebarTab('properties');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks(items => {
                const oldIdx = items.findIndex(i => i.id === active.id);
                const newIdx = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIdx, newIdx);
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };
    React.useEffect(() => {
        const move = (e: MouseEvent) => isResizing && setVariablesWidth(Math.max(250, Math.min(600, e.clientX)));
        const stop = () => setIsResizing(false);
        if (isResizing) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
    }, [isResizing]);

    const handleCommit = () => {
        onSave({ name, category, channel, subject, previewText, body, blocks, styleId });
    };

    const resolvedPreviewHtml = React.useMemo(() => {
        if (channel === 'email') {
            const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
            return renderBlocksToHtml(blocks, simVariables, {
                wrapper: activeStyle?.htmlWrapper
            });
        }
        return resolveVariables(body, simVariables);
    }, [channel, blocks, simVariables, styleId, styles, body]);

    const filteredVars = React.useMemo(() => {
        return variables.filter(v => (
            v.category === 'general' || 
            v.category === category || 
            v.category === 'finance' ||
            (category === 'contracts' && v.category === 'finance')
        ) && !v.hidden);
    }, [variables, category]);

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden text-left">
            <div className="bg-background border-b pt-6 shrink-0 flex items-center justify-between px-8">
                <div className="flex justify-center items-center mb-8 max-w-2xl mx-auto px-4">
                    {[
                        { n: 1, label: 'Configuration', icon: Settings2 },
                        { n: 2, label: 'Workshop', icon: Layout },
                        { n: 3, label: 'Simulation', icon: MonitorPlay }
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            <button type="button" onClick={() => (s.n < step || name) && setStep(s.n)} className="flex flex-col items-center group outline-none">
                                <div className={cn('flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 shadow-sm', step > s.n ? 'bg-primary border-primary text-white' : step === s.n ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground')}>
                                    {step > s.n ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                                </div>
                                <p className={cn('mt-3 text-[10px] font-black uppercase tracking-widest transition-colors', step >= s.n ? 'text-primary' : 'text-muted-foreground opacity-60')}>{s.label}</p>
                            </button>
                            {i < 2 && <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden"><motion.div initial={false} animate={{ width: step > s.n ? '100%' : '0%' }} className="h-full bg-primary" /></div>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex items-center gap-3 pb-6">
                    {step > 1 && (
                        <Button 
                            variant="outline" 
                            onClick={() => setIsTestModalOpen(true)} 
                            className="rounded-xl font-bold border-primary/20 text-primary h-11 px-6 gap-2"
                        >
                            <FlaskConical className="h-4 w-4" /> Send Test
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onCancel} className="font-bold h-11">Discard</Button>
                    <Button onClick={handleCommit} disabled={isSaving || !name} className="rounded-xl font-black px-10 shadow-xl bg-primary text-white h-11 transition-all active:scale-95 uppercase tracking-widest">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Template
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" {...stepTransition} className="absolute inset-0 p-8 overflow-y-auto">
                            <div className="max-w-2xl mx-auto space-y-8 pb-20 text-left">
                                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                                    <CardHeader className="bg-muted/30 border-b p-8">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Settings2 className="h-6 w-6" /></div>
                                            <div>
                                                <CardTitle className="text-2xl font-black uppercase tracking-tight">Identity & Parameters</CardTitle>
                                                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Configure the master parameters for this template.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-10 space-y-10">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name</Label>
                                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Admission Confirmation" className="h-14 rounded-2xl border-none bg-muted/20 px-6 py-2 text-xl font-black shadow-inner ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Context</Label>
                                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="general">General</SelectItem>
                                                        <SelectItem value="finance">Finance Hub</SelectItem>
                                                        <SelectItem value="contracts">Legal Contracts</SelectItem>
                                                        <SelectItem value="meetings">Meetings</SelectItem>
                                                        <SelectItem value="surveys">Surveys</SelectItem>
                                                        <SelectItem value="forms">Forms</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-4">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Medium</Label>
                                                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl border shadow-inner">
                                                    <button type="button" onClick={() => setChannel('email')} className={cn("h-10 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all", channel === 'email' ? "bg-white shadow-md text-primary" : "text-muted-foreground opacity-60")}>Email</button>
                                                    <button type="button" onClick={() => setChannel('sms')} className={cn("h-10 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all", channel === 'sms' ? "bg-white shadow-md text-primary" : "text-muted-foreground opacity-60")}>SMS</button>
                                                </div>
                                            </div>
                                        </div>
                                        {channel === 'email' && (
                                            <div className="space-y-8 pt-8 border-t border-dashed">
                                                <div className="space-y-6">
                                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject Line</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-6" /></div>
                                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Preview Text</Label><Input value={previewText} onChange={e => setPreviewText(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-medium text-sm px-6" /></div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="justify-between bg-muted/30 p-8 border-t">
                                        <Button variant="ghost" onClick={onCancel} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                                        <Button 
                                            type="button" 
                                            onClick={() => setStep(2)} 
                                            disabled={!name}
                                            className="px-12 rounded-xl font-black shadow-2xl h-12 uppercase tracking-widest text-sm transition-all active:scale-95 gap-2 group"
                                        >
                                            Next Phase 
                                            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" {...stepTransition} className={cn("absolute inset-0 flex select-none bg-background transition-all duration-500", isFullScreen && "fixed inset-0 z-[100] h-screen w-screen")}>
                            <div className="border-r bg-background flex flex-col shrink-0 relative transition-all duration-300 shadow-xl" style={{ width: variablesWidth }}>
                                <Tabs value={sidebarTab} onValueChange={(v: any) => setSidebarTab(v)} className="flex-1 flex flex-col min-h-0">
                                    <div className="px-2 py-2 border-b bg-muted/10 shrink-0 text-left">
                                        {channel === 'email' ? (
                                            <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 p-1 rounded-xl">
                                                <TabsTrigger value="blocks" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                <TabsTrigger value="tags" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Database className="h-3 w-3" /> Tags</TabsTrigger>
                                                <TabsTrigger value="properties" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Settings2 className="h-3 w-3" /> Props</TabsTrigger>
                                            </TabsList>
                                        ) : (
                                            <div className="flex items-center gap-2 px-2 h-10"><Database className="h-4 w-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Contextual Registry</span></div>
                                        )}
                                    </div>
                                    
                                    <TabsContent value="blocks" className="m-0 flex-1 min-h-0 bg-muted/5 border-t outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4 space-y-8 text-left">
                                                <div className="grid grid-cols-2 gap-3">
                                                    {Object.entries(blockIcons).slice(0, 8).map(([type, Icon]) => (
                                                        <button key={type} onClick={() => handleAddBlock(type as any)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 group aspect-square">
                                                            <Icon className="h-5 w-5 mb-2 group-hover:text-primary transition-colors" />
                                                            <span className="text-[10px] font-black uppercase tracking-tight text-foreground/70 group-hover:text-primary">{type}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                    
                                    <TabsContent value="tags" className="m-0 flex-1 min-h-0 bg-muted/5 border-t text-left outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4 space-y-2">
                                                {filteredVars.map(v => (
                                                    <button key={v.id} onClick={() => { navigator.clipboard.writeText(`{{${v.key}}}`); toast({ title: 'Tag Copied' }); }} className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group bg-white shadow-sm">
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60">{v.sourceName || 'Core'}</span>
                                                        <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                        <code className="text-[9px] font-mono text-primary/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                    </button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                    
                                    <TabsContent value="properties" className="m-0 flex-1 min-h-0 bg-muted/5 border-t text-left outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4">
                                                {selectedBlockId ? (
                                                    <BlockInspector block={blocks.find(b => b.id === selectedBlockId)!} variables={variables} onUpdate={u => setBlocks(p => p.map(b => b.id === selectedBlockId ? { ...b, ...u } : b))} />
                                                ) : (
                                                    <div className="py-20 text-center opacity-30 px-4 text-left"><Layout className="h-8 w-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Select a block on the canvas<br/>to edit properties</p></div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                                <div className={cn("absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-50 transition-colors", isResizing ? "bg-primary/40" : "hover:bg-primary/20")} onMouseDown={handleMouseDown} />
                            </div>

                            <div className="flex-1 flex flex-col bg-muted/10 min-w-0">
                                <div className="p-4 border-b bg-background shrink-0 flex items-center justify-between z-20 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        {channel === 'email' && (
                                            <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)}>
                                                <TabsList className="bg-muted/50 p-1 rounded-xl h-9 border">
                                                    <TabsTrigger value="designer" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Layout className="h-3 w-3" /> Designer</TabsTrigger>
                                                    <TabsTrigger value="code" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Code className="h-3 w-3" /> Code</TabsTrigger>
                                                </TabsList>
                                            </Tabs>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {channel === 'email' && (
                                            <div className="flex items-center gap-2 mr-2">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Style Wrapper:</Label>
                                                <Select value={styleId} onValueChange={setStyleId}>
                                                    <SelectTrigger className="h-9 w-40 rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">No Wrapper (Raw)</SelectItem>
                                                        {styles.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(!isFullScreen)} className="h-9 rounded-xl font-bold gap-2 text-xs border border-border/50">
                                            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            {isFullScreen ? 'Exit Zen' : 'Zen Mode'}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setStep(3)} className="h-9 rounded-xl font-bold gap-2 text-xs border-primary/20 hover:bg-primary/5 text-primary">
                                            <Eye className="h-4 w-4" /> Simulation Studio
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1" onClick={() => setSelectedBlockId(null)}>
                                    <div className="max-w-4xl mx-auto p-8 pb-64">
                                        {channel === 'email' && editorMode === 'designer' ? (
                                            <div className="max-w-[600px] mx-auto bg-white shadow-2xl rounded-[2.5rem] border border-border/50 min-h-[800px] relative overflow-hidden text-left">
                                                <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                                                <div className="p-12 space-y-2">
                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                            <div className="space-y-4">
                                                                {blocks.map((block, idx) => (
                                                                    <SortableBlockItem 
                                                                        key={block.id} 
                                                                        id={block.id} 
                                                                        index={idx} 
                                                                        block={block} 
                                                                        isSelected={selectedBlockId === block.id} 
                                                                        simulationVars={simVariables}
                                                                        onSelect={() => { setSelectedBlockId(block.id); setSidebarTab('properties'); }}
                                                                        onRemove={() => {
                                                                            setBlocks(prev => prev.filter(b => b.id !== block.id));
                                                                            if (selectedBlockId === block.id) setSelectedBlockId(null);
                                                                        }}
                                                                        onDuplicate={() => { const next = [...blocks]; next.splice(idx + 1, 0, { ...block, id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }); setBlocks(next); }}
                                                                        onSwap={(a, b) => setBlocks(p => arrayMove(p, a, b))}
                                                                        totalCount={blocks.length}
                                                                        onUpdate={u => setBlocks(p => p.map(b => b.id === block.id ? { ...b, ...u } : b))}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </DndContext>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Manual Logic Editor</Label>
                                                <div className="p-1 rounded-[2.5rem] shadow-2xl bg-slate-900 overflow-hidden">
                                                    <Textarea value={body} onChange={e => setBody(e.target.value)} className="min-h-[600px] rounded-[2rem] font-mono text-sm leading-relaxed p-10 border-none shadow-none focus-visible:ring-0 bg-slate-900 text-blue-400" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <SimulationStudio 
                            template={initialTemplate || ({} as any)} 
                            simVariables={simVariables} 
                            isSimLoading={isSimLoading} 
                            simEntity={simEntity} setSimEntity={setSimEntity} 
                            simRecordId={simRecordId} setSimRecordId={setSimRecordId} 
                            schools={schools} meetings={meetings} surveys={surveys} pdfs={pdfs}
                            resolvedPreview={(tmpl, vars) => {
                                if (channel === 'email') {
                                    const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
                                    return renderBlocksToHtml(blocks, vars, {
                                        wrapper: activeStyle?.htmlWrapper
                                    });
                                }
                                return resolveVariables(body, vars);
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>

            <TestDispatchDialog 
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                channel={channel as 'email' | 'sms'}
                rawBody={resolvedPreviewHtml}
                rawSubject={resolveVariables(subject, simVariables)}
                variables={simVariables}
                schoolId={simEntity === 'School' ? simRecordId : undefined}
            />
        </div>
    );
}
