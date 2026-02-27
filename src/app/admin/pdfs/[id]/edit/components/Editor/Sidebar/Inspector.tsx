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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, 
  Trash2, Key, AlignStartHorizontal, AlignCenterHorizontal, 
  AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Copy, Bold, Italic, Underline, Type, FileText, Settings, AlignLeft, AlignCenter, AlignRight,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
} from 'lucide-react';
import { PDFFormField } from '@/lib/types';
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
};

export function Inspector() {
  const { 
    fields, selectedFieldIds, setSelectedFieldIds, namingFieldId, setNamingFieldId,
    updateField, removeField, duplicateFields, alignFields, distributeFields,
    isSidebarCollapsed
  } = useEditor();

  const selectedField = selectedFieldIds.length === 1 ? fields.find(f => f.id === selectedFieldIds[0]) : null;
  const isMulti = selectedFieldIds.length > 1;

  if (isSidebarCollapsed) {
    return (
      <ScrollArea className="flex-grow">
        <div className="flex flex-col items-center gap-6 py-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground cursor-help">
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

  const isTextType = selectedField?.type === 'text' || selectedField?.type === 'dropdown' || selectedField?.type === 'phone' || selectedField?.type === 'email' || selectedField?.type === 'date' || selectedField?.type === 'time';

  return (
    <ScrollArea className="flex-grow">
      <div className="p-4 space-y-4">
        
        {/* Selection Context */}
        {selectedField ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="py-4">
              <CardTitle className="flex justify-between items-center text-sm font-semibold">
                <span>Field Properties</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeField(selectedField.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription className="text-[10px] font-mono">ID: {selectedField.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Label</Label>
                <Input value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="h-9 text-sm rounded-xl bg-background border-border/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Placeholder</Label>
                <Input value={selectedField.placeholder || ''} onChange={e => updateField(selectedField.id, { placeholder: e.target.value })} className="h-9 text-sm rounded-xl bg-background border-border/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Type</Label>
                <Select value={selectedField.type} onValueChange={(v: PDFFormField['type']) => updateField(selectedField.id, { type: v, options: v === 'dropdown' ? (selectedField.options || ['Option 1', 'Option 2']) : undefined })}>
                  <SelectTrigger className="h-9 text-sm capitalize rounded-xl bg-background border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{Object.keys(fieldIcons).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedField.type === 'dropdown' && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Options (One per line)</Label>
                  <Textarea value={selectedField.options?.join('\n')} onChange={e => updateField(selectedField.id, { options: e.target.value.split('\n').filter(Boolean) })} className="min-h-[100px] text-xs rounded-xl bg-background border-border/50" />
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-background">
                <Label className="text-xs font-bold">Required Field</Label>
                <Switch checked={!!selectedField.required} onCheckedChange={v => updateField(selectedField.id, { required: v })} />
              </div>
              
              {isTextType && (
                <div className="space-y-4 pt-4 border-t mt-2">
                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Typography</h4>
                  
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

                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Horizontal Text Align</Label>
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
                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Vertical Text Align</Label>
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
                                {a === 'top' && <AlignStartHorizontal className="h-4 w-4" />}
                                {a === 'center' && <AlignCenterHorizontal className="h-4 w-4" />}
                                {a === 'bottom' && <AlignEndHorizontal className="h-4 w-4" />}
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

              <div className="flex items-center justify-between rounded-xl border border-primary/20 p-3 bg-white shadow-sm mt-4">
                <div className="space-y-0.5">
                  <Label className="text-xs flex items-center gap-1.5 font-black text-primary uppercase tracking-tighter"><Key className="h-3 w-3" /> Naming Field</Label>
                  <p className="text-[9px] text-muted-foreground leading-none font-medium">Use for submission titles</p>
                </div>
                <Switch checked={namingFieldId === selectedField.id} onCheckedChange={v => setNamingFieldId(v ? selectedField.id : null)} />
              </div>
            </CardContent>
          </Card>
        ) : isMulti ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Bulk Editing</CardTitle>
              <CardDescription className="text-xs font-bold">{selectedFieldIds.length} elements selected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Object Alignment</Label>
                <div className="grid grid-cols-3 gap-1 bg-background p-1 rounded-xl border border-border/50">
                  <TooltipProvider>
                    {(['left', 'center-h', 'right', 'top', 'center-v', 'bottom'] as const).map(a => (
                      <Tooltip key={a}>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" onClick={() => alignFields(a)} className="h-9 rounded-lg hover:bg-primary/10 hover:text-primary">
                            {a === 'left' && <AlignStartVertical className="h-4 w-4" />}
                            {a === 'center-h' && <AlignCenterVertical className="h-4 w-4" />}
                            {a === 'right' && <AlignEndVertical className="h-4 w-4" />}
                            {a === 'top' && <AlignStartHorizontal className="h-4 w-4" />}
                            {a === 'center-v' && <AlignCenterHorizontal className="h-4 w-4" />}
                            {a === 'bottom' && <AlignEndHorizontal className="h-4 w-4" />}
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
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Distribution</Label>
                <div className="grid grid-cols-2 gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => distributeFields('horizontal')}>
                          <AlignHorizontalDistributeCenter className="h-4 w-4 mr-2 text-primary"/>Horiz.
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Distribute Horizontally</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => distributeFields('vertical')}>
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
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-2" onClick={() => duplicateFields(selectedFieldIds)}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl text-xs font-bold gap-2 text-destructive hover:bg-destructive/10" onClick={() => { setFields(p => p.filter(f => !selectedFieldIds.includes(f.id))); setSelectedFieldIds([]); }}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="py-4 border-b bg-muted/5">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Document Fields</CardTitle>
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
