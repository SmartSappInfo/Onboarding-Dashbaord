'use client';

import * as React from 'react';
import { useEditor } from '../EditorContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { 
  Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, 
  Trash2, Key, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, 
  AlignVerticalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  Copy, Bold, Italic, Underline, Type, FileText, Settings, AlignLeft, AlignCenter, AlignRight,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Tag, 
  Layers, ArrowRightLeft, Database, Building, AlertCircle, Pipette, RefreshCw, Baseline,
  CaseUpper, CaseSensitive
} from 'lucide-react';
import { PDFFormField, AppField, FieldGroup } from '@/lib/types';
import { SortableFieldList } from './SortableFieldList';
import { cn } from '@/lib/utils';

const fieldIcons: Record<PDFFormField['type'], React.ElementType> = {
  text: Text,
  signature: Signature,
  date: Calendar,
  dropdown: ChevronDownSquare,
  phone: Phone,
  email: Mail,
  time: Clock,
  photo: Camera,
  'static-text': Tag,
  variable: Database,
};

export function Inspector() {
  const { 
    pdf, fields, selectedFieldIds, namingFieldId, setNamingFieldId,
    updateField, isSidebarCollapsed, numPages, setIsFieldDeleteConfirmOpen,
    alignFields, distributeFields, duplicateFields
  } = useEditor();

  const firestore = useFirestore();
  const { activeWorkspaceId } = useTenant();

  // Field Groups
  const fieldGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'field_groups'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: fieldGroups } = useCollection<FieldGroup>(fieldGroupsQuery);

  // App Fields
  const appFieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'app_fields'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: appFields } = useCollection<AppField>(appFieldsQuery);

  const groupedVariables = React.useMemo(() => {
    if (!fieldGroups || !appFields) return [];
    return fieldGroups.map(g => ({
      label: g.name,
      options: appFields
        .filter(f => f.groupId === g.id && f.status === 'active' && f.type !== 'hidden')
        .map(f => ({ key: f.variableName, label: f.label }))
    })).filter(g => g.options.length > 0);
  }, [fieldGroups, appFields]);

  const allVariablesFlattened = React.useMemo(() => {
    return groupedVariables.flatMap(g => g.options);
  }, [groupedVariables]);

  const selectedField = selectedFieldIds.length === 1 ? fields.find(f => f.id === selectedFieldIds[0]) : null;
  const isMulti = selectedFieldIds.length > 1;

  if (isSidebarCollapsed) {
    return (
 <ScrollArea className="flex-grow">
 <div className="flex flex-col items-center gap-6 py-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
 <div className="p-2 rounded-lg bg-background0 text-muted-foreground cursor-help">
 <FileText className="h-5 w-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">Document Fields</TooltipContent>
            </Tooltip>

            {selectedField && (
              <Tooltip>
                <TooltipTrigger asChild>
 <div className="p-2 rounded-lg bg-primary/10 text-primary animate-in zoom-in-50 duration-300 cursor-help">
 <Settings className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">Field Properties</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </ScrollArea>
    );
  }

  const isTextType = selectedField?.type === 'text' || selectedField?.type === 'dropdown' || selectedField?.type === 'phone' || selectedField?.type === 'email' || selectedField?.type === 'date' || selectedField?.type === 'time' || selectedField?.type === 'static-text' || selectedField?.type === 'variable';

  return (
 <ScrollArea className="flex-grow bg-card">
 <div className="p-4 space-y-4 text-left">
        
        {/* Selection Context */}
        {selectedField ? (
  <Card className="border border-primary/20 bg-primary/5 rounded-2xl shadow-sm">
 <CardHeader className="py-4">
 <CardTitle className="flex justify-between items-center text-sm font-semibold">
                <span>Field Properties</span>
 <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => setIsFieldDeleteConfirmOpen(true)}>
 <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
 <CardDescription className="text-[10px] font-mono">ID: {selectedField.id}</CardDescription>
            </CardHeader>
 <CardContent className="p-4 space-y-4">
              {selectedField.type === 'static-text' ? (
 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-primary ml-1">Label Content</Label>
                    <Textarea 
                        value={selectedField.staticText || ''} 
                        onChange={e => updateField(selectedField.id, { staticText: e.target.value })} 
 className="min-h-[100px] text-sm rounded-xl bg-background border-primary/20 shadow-inner p-3"
                        placeholder="Type text to display on the document..."
                    />
                </div>
              ) : selectedField.type === 'variable' ? (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
 <Building className="h-3 w-3" /> Entity Data Context
                        </Label>
                        {pdf.entityId ? (
                            <Select 
                                value={selectedField.variableKey} 
                                onValueChange={(val) => updateField(selectedField.id, { variableKey: val, label: allVariablesFlattened.find(v => v.key === val)?.label })}
                            >
                                 <SelectTrigger className="h-11 rounded-xl bg-background border border-border font-bold shadow-sm focus:ring-1 focus:ring-primary/20 transition-all">
                                    <SelectValue placeholder="Pick entity field..." />
                                </SelectTrigger>
 <SelectContent className="rounded-xl">
                                    {groupedVariables.map(g => (
                                        <SelectGroup key={g.label}>
                                            <SelectLabel className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{g.label}</SelectLabel>
                                            {g.options.map(v => (
                                                <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
 <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex flex-col items-center text-center gap-2">
 <AlertCircle className="h-5 w-5 text-orange-600" />
 <p className="text-[9px] font-semibold text-orange-800 leading-tight">No Entity Associated</p>
 <p className="text-[8px] font-bold text-orange-700/60 tracking-tighter">Please bind this document to an entity in "Step 1: Setup" to use variables.</p>
                            </div>
                        )}
                    </div>
                    {selectedField.variableKey && (
 <div className="p-3 bg-background rounded-xl border border-dashed border-primary/20 flex flex-col items-center justify-center gap-1.5 shadow-inner">
 <span className="text-[9px] font-semibold opacity-40">Active Placeholder</span>
 <code className="text-xs font-semibold text-primary">{"{{" + selectedField.variableKey + "}}"}</code>
                        </div>
                    )}
                </div>
              ) : (
                <>
 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Label</Label>
 <Input value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="h-9 text-sm rounded-xl bg-background border-border/50" />
                    </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Placeholder</Label>
 <Input value={selectedField.placeholder || ''} onChange={e => updateField(selectedField.id, { placeholder: e.target.value })} className="h-9 text-sm rounded-xl bg-background border-border/50" />
                    </div>
                </>
              )}
              
 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Type</Label>
                <Select value={selectedField.type} onValueChange={(v: PDFFormField['type']) => updateField(selectedField.id, { type: v, options: v === 'dropdown' ? (selectedField.options || ['Option 1', 'Option 2']) : undefined })}>
  <SelectTrigger className="h-9 text-sm capitalize rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-xl">{Object.keys(fieldIcons).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>

 <div className="space-y-2 pt-2 border-t">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
 <ArrowRightLeft className="h-3 w-3" /> Page Location
                </Label>
                <Select 
                  value={String(selectedField.pageNumber)} 
                  onValueChange={(v) => updateField(selectedField.id, { pageNumber: parseInt(v, 10) })}
                >
 <SelectTrigger className="h-10 bg-background border-primary/20 rounded-xl font-bold text-xs">
 <div className="flex items-center gap-2">
 <Layers className="h-3.5 w-3.5 opacity-40" />
                      <SelectValue placeholder="Select page..." />
                    </div>
                  </SelectTrigger>
 <SelectContent className="rounded-xl">
                    {Array.from({ length: numPages || 1 }).map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)}>Page {i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedField.type === 'dropdown' && (
 <div className="space-y-2 pt-2 border-t">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Options (One per line)</Label>
 <Textarea value={selectedField.options?.join('\n')} onChange={e => updateField(selectedField.id, { options: e.target.value.split('\n').filter(Boolean) })} className="min-h-[100px] text-xs rounded-xl bg-background border-border/50" />
                </div>
              )}
              
              {selectedField.type !== 'static-text' && selectedField.type !== 'variable' && (
  <div className="flex items-center justify-between rounded-xl border border-border p-3 bg-background shadow-sm">
 <Label className="text-xs font-bold">Required Field</Label>
                    <Switch checked={!!selectedField.required} onCheckedChange={v => updateField(selectedField.id, { required: v })} />
                </div>
              )}
              
              {isTextType && (
 <div className="space-y-4 pt-4 border-t mt-2">
 <h4 className="text-[10px] font-semibold text-primary px-1">Typography</h4>
                  
 <div className="space-y-3 px-1">
 <div className="flex justify-between items-center">
 <Label className="text-xs flex items-center gap-1.5"><Type className="h-3 w-3 text-muted-foreground" /> Font Size</Label>
 <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded font-bold">{selectedField.fontSize || 11}pt</span>
                    </div>
 <div className="px-1">
                      <Slider
                        value={[selectedField.fontSize || 11]}
                        min={8}
                        max={36}
                        step={1}
                        onValueChange={([val]) => updateField(selectedField.id, { fontSize: val })}
                      />
                    </div>
                  </div>

 <div className="space-y-3 px-1">
 <Label className="text-xs flex items-center gap-1.5"><Pipette className="h-3 w-3 text-muted-foreground" /> Font Color</Label>
 <div className="flex items-center gap-2">
 <div className="flex h-10 border border-border/50 rounded-xl overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner flex-1">
 <div className="bg-muted px-2.5 flex items-center border-r">
                                <Input 
                                    type="color" 
                                    value={selectedField.color || '#000000'} 
                                    onChange={e => updateField(selectedField.id, { color: e.target.value })} 
 className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer"
                                />
                            </div>
                            <Input 
                                value={selectedField.color || '#000000'} 
                                onChange={e => updateField(selectedField.id, { color: e.target.value })}
 className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono text-[10px] " 
                            />
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
 className="h-10 w-10 rounded-xl hover:bg-muted"
                            onClick={() => updateField(selectedField.id, { color: '#000000' })}
                            title="Reset to Black"
                        >
 <RefreshCw className="h-3.5 w-3.5 opacity-40" />
                        </Button>
                    </div>
                  </div>

 <div className="grid grid-cols-1 gap-4 px-1">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Style</Label>
 <div className="grid grid-cols-3 gap-2">
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button 
                                    type="button"
                                    variant={selectedField.bold ? "secondary" : "outline"} 
                                    size="icon" 
 className={cn("h-9 w-full rounded-xl", selectedField.bold && "bg-primary/10 text-primary border-primary/20")}
                                    onClick={() => updateField(selectedField.id, { bold: !selectedField.bold })}
                                >
 <Bold className="h-4 w-4" />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>Bold</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button 
                                    type="button"
                                    variant={selectedField.italic ? "secondary" : "outline"} 
                                    size="icon" 
 className={cn("h-9 w-full rounded-xl", selectedField.italic && "bg-primary/10 text-primary border-primary/20")}
                                    onClick={() => updateField(selectedField.id, { italic: !selectedField.italic })}
                                >
 <Italic className="h-4 w-4" />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>Italic</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button 
                                    type="button"
                                    variant={selectedField.underline ? "secondary" : "outline"} 
                                    size="icon" 
 className={cn("h-9 w-full rounded-xl", selectedField.underline && "bg-primary/10 text-primary border-primary/20")}
                                    onClick={() => updateField(selectedField.id, { underline: !selectedField.underline })}
                                >
 <Underline className="h-4 w-4" />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>Underline</TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Case Transformation</Label>
 <div className="grid grid-cols-3 gap-2 bg-muted/20 p-1 rounded-xl">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            type="button" 
                                            variant={!selectedField.textTransform || selectedField.textTransform === 'none' ? 'secondary' : 'ghost'} 
 className={cn("h-8 rounded-lg text-[9px] font-semibold ", (!selectedField.textTransform || selectedField.textTransform === 'none') && "bg-card shadow-sm")} 
                                            onClick={() => updateField(selectedField.id, { textTransform: 'none' })}
                                        >
 <Baseline className="h-3 w-3 mr-1" /> Aa
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Normal</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            type="button" 
                                            variant={selectedField.textTransform === 'uppercase' ? 'secondary' : 'ghost'} 
 className={cn("h-8 rounded-lg text-[9px] font-semibold ", selectedField.textTransform === 'uppercase' && "bg-card shadow-sm")} 
                                            onClick={() => updateField(selectedField.id, { textTransform: 'uppercase' })}
                                        >
 <CaseUpper className="h-3 w-3 mr-1" /> ABC
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>UPPERCASE</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            type="button" 
                                            variant={selectedField.textTransform === 'capitalize' ? 'secondary' : 'ghost'} 
 className={cn("h-8 rounded-lg text-[9px] font-semibold ", selectedField.textTransform === 'capitalize' && "bg-card shadow-sm")} 
                                            onClick={() => updateField(selectedField.id, { textTransform: 'capitalize' })}
                                        >
 <CaseSensitive className="h-3 w-3 mr-1" /> Title
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Title Case</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                  </div>

 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Horizontal Text Align</Label>
 <div className="grid grid-cols-3 gap-1 bg-background p-1 rounded-xl border border-border/50">
                      <TooltipProvider>
                        {(['left', 'center', 'right'] as const).map(a => (
                          <Tooltip key={a}>
                            <TooltipTrigger asChild>
                              <Button 
                                type="button"
                                variant={selectedField.alignment === a ? "secondary" : "ghost"} 
                                size="sm" 
                                onClick={() => updateField(selectedField.id, { alignment: a })} 
 className={cn("h-9 rounded-lg", selectedField.alignment === a && "bg-primary/10 text-primary")}
                              >
 {a === 'left' && <AlignLeft className="h-4 w-4" />}
 {a === 'center' && <AlignCenter className="h-4 w-4" />}
 {a === 'right' && <AlignRight className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Align {a.charAt(0).toUpperCase() + a.slice(1)}</TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  </div>

 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Vertical Text Align</Label>
 <div className="grid grid-cols-3 gap-1 bg-background p-1 rounded-xl border border-border/50">
                      <TooltipProvider>
                        {(['top', 'center', 'bottom'] as const).map(a => (
                          <Tooltip key={a}>
                            <TooltipTrigger asChild>
                              <Button 
                                type="button"
                                variant={selectedField.verticalAlignment === a ? "secondary" : "ghost"} 
                                size="sm" 
                                onClick={() => updateField(selectedField.id, { verticalAlignment: a })} 
 className={cn("h-9 rounded-lg", selectedField.verticalAlignment === a && "bg-primary/10 text-primary")}
                              >
 {a === 'top' && <AlignVerticalJustifyStart className="h-4 w-4" />}
 {a === 'center' && <AlignVerticalJustifyCenter className="h-4 w-4" />}
 {a === 'bottom' && <AlignVerticalJustifyEnd className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Align {a.charAt(0).toUpperCase() + a.slice(1)}</TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              )}

              {selectedField.type !== 'static-text' && selectedField.type !== 'variable' && (
 <div className="flex items-center justify-between rounded-xl border border-primary/20 p-3 bg-card shadow-sm mt-4">
 <div className="space-y-0.5">
 <Label className="text-xs flex items-center gap-1.5 font-semibold text-primary tracking-tighter"><Key className="h-3 w-3" /> Naming Field</Label>
 <p className="text-[9px] text-muted-foreground leading-none font-medium">Use for submission titles</p>
                    </div>
                    <Switch checked={namingFieldId === selectedField.id} onCheckedChange={v => setNamingFieldId(v ? selectedField.id : null)} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : isMulti ? (
 <Card className="border-primary/20 bg-primary/5">
 <CardHeader className="py-4">
 <CardTitle className="text-sm font-semibold text-primary">Bulk Editing</CardTitle>
 <CardDescription className="text-xs font-bold">{selectedFieldIds.length} elements selected</CardDescription>
            </CardHeader>
 <CardContent className="space-y-6">
 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Object Alignment</Label>
 <div className="grid grid-cols-3 gap-1 bg-background p-1 rounded-xl border border-border/50">
                  <TooltipProvider>
                    {(['left', 'center-h', 'right', 'top', 'center-v', 'bottom'] as const).map(a => (
                      <Tooltip key={a}>
                        <TooltipTrigger asChild>
 <Button type="button" variant="ghost" size="sm" onClick={() => alignFields?.(a)} className="h-9 rounded-lg hover:bg-primary/10 hover:text-primary">
 {a === 'left' && <AlignHorizontalJustifyStart className="h-4 w-4" />}
 {a === 'center-h' && <AlignHorizontalJustifyCenter className="h-4 w-4" />}
 {a === 'right' && <AlignHorizontalJustifyEnd className="h-4 w-4" />}
 {a === 'top' && <AlignVerticalJustifyStart className="h-4 w-4" />}
 {a === 'center-v' && <AlignVerticalJustifyCenter className="h-4 w-4" />}
 {a === 'bottom' && <AlignVerticalJustifyEnd className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {a === 'left' ? 'Align Left edges' : 
                           a === 'center-h' ? 'Align Horizontal centers' : 
                           a === 'right' ? 'Align Right edges' : 
                           a === 'top' ? 'Align Top edges' : 
                           a === 'center-v' ? 'Align Vertical centers' : 
                           'Align Bottom edges'}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
 <div className="space-y-3 border-t pt-4">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Distribution</Label>
 <div className="grid grid-cols-2 gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
 <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => distributeFields?.('horizontal')}>
 <AlignHorizontalDistributeCenter className="h-4 w-4 mr-2 text-primary"/>Horiz.
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Distribute Horizontally</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
 <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => distributeFields?.('vertical')}>
 <AlignVerticalDistributeCenter className="h-4 w-4 mr-2 text-primary"/>Vert.
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Distribute Vertically</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
 <div className="space-y-4 border-t pt-4">
 <div className="grid grid-cols-2 gap-2">
 <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-2" onClick={() => duplicateFields?.(selectedFieldIds)}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
 <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl text-xs font-bold gap-2 text-destructive hover:bg-destructive/10" onClick={() => setIsFieldDeleteConfirmOpen(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
 <CardHeader className="py-4 border-b bg-background">
 <CardTitle className="text-sm font-semibold text-foreground">Document Fields</CardTitle>
 <CardDescription className="text-[10px] font-bold">{(fields || []).length} active mapping points</CardDescription>
              </CardHeader>
 <CardContent className="p-2">
                <SortableFieldList />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
