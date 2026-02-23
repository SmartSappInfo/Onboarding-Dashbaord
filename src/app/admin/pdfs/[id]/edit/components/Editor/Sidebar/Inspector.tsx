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
import { 
  Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, 
  Trash2, Sparkles, Key, Check, X, AlignStartHorizontal, AlignCenterHorizontal, 
  AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Copy, Replace, Lock, Eye, EyeOff
} from 'lucide-react';
import { PDFFormField } from '@/lib/types';
import { SortableFieldList } from './SortableFieldList';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

const DistributeHorizontal = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="6" height="14" x="2" y="5" rx="1"/><rect width="6" height="14" x="16" y="5" rx="1"/><path d="M12 2v20"/>
  </svg>
);

const DistributeVertical = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="14" height="6" x="5" y="2" rx="1"/><rect width="14" height="6" x="5" y="16" rx="1"/><path d="M2 12h20"/>
  </svg>
);

export function Inspector() {
  const { 
    fields, setFields, selectedFieldIds, setSelectedFieldIds, namingFieldId, setNamingFieldId,
    addField, updateField, removeField, duplicateFields, alignFields, distributeFields,
    isSidebarCollapsed, isDetecting, onDetect, pdf, onStatusChange, isStatusChanging,
    password, setPassword, passwordProtected, setPasswordProtected
  } = useEditor();

  const selectedField = selectedFieldIds.length === 1 ? fields.find(f => f.id === selectedFieldIds[0]) : null;
  const isMulti = selectedFieldIds.length > 1;
  const hasSuggestions = fields.some(f => f.isSuggestion);
  const [showPassword, setShowPassword] = React.useState(false);

  const bulkUpdate = (props: Partial<PDFFormField>) => {
    setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, ...props } : f));
  };

  if (isSidebarCollapsed) {
    return (
      <ScrollArea className="flex-grow">
        <div className="p-2 space-y-4">
          <SortableFieldList />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-grow">
      <div className="p-4 space-y-4">
        {/* Quick Add Section */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Quick Add</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pb-4">
            {(Object.keys(fieldIcons) as Array<keyof typeof fieldIcons>).map(type => (
              <Button key={type} variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2 capitalize" onClick={() => addField(type)}>
                {React.createElement(fieldIcons[type], { className: "h-3 w-3 mr-1.5 text-primary" })} {type}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* AI Section */}
        <Card className={cn(hasSuggestions && "border-green-500 bg-green-50/10")}>
          <CardHeader className="py-3"><CardTitle className="text-[10px] font-bold uppercase flex items-center gap-1.5 tracking-widest"><Sparkles className="h-3 w-3 text-primary" /> AI Assistant</CardTitle></CardHeader>
          <CardContent className="space-y-2 pb-4">
            {!hasSuggestions ? (
              <Button onClick={onDetect} disabled={isDetecting} className="w-full h-9 text-xs font-bold">
                {isDetecting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />} Auto-Detect Fields
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-xs" onClick={() => setFields(prev => prev.map(f => ({ ...f, isSuggestion: false })))}>
                  <Check className="h-3 w-3 mr-2" /> Accept All
                </Button>
                <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 text-xs" onClick={() => setFields(prev => prev.filter(f => !f.isSuggestion))}>
                  <X className="h-3 w-3 mr-2" /> Reject All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Forms */}
        {selectedField ? (
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="flex justify-between items-center text-sm font-semibold"><span>Field Properties</span><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(selectedField.id)}><Trash2 className="h-4 w-4" /></Button></CardTitle>
              <CardDescription className="text-[10px]">ID: {selectedField.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label className="text-xs">Label</Label><Input value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="h-8 text-sm" /></div>
              <div className="space-y-2"><Label className="text-xs">Placeholder</Label><Input value={selectedField.placeholder || ''} onChange={e => updateField(selectedField.id, { placeholder: e.target.value })} className="h-8 text-sm" /></div>
              <div className="space-y-2"><Label className="text-xs">Type</Label>
                <Select value={selectedField.type} onValueChange={(v: PDFFormField['type']) => updateField(selectedField.id, { type: v, options: v === 'dropdown' ? (selectedField.options || ['Option 1', 'Option 2']) : undefined })}>
                  <SelectTrigger className="h-8 text-sm capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(fieldIcons).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedField.type === 'dropdown' && (
                <div className="space-y-2 pt-2 border-t"><Label className="text-xs">Options</Label><Textarea value={selectedField.options?.join('\n')} onChange={e => updateField(selectedField.id, { options: e.target.value.split('\n').filter(Boolean) })} className="min-h-[80px] text-xs" /></div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3"><Label className="text-xs">Required</Label><Switch checked={!!selectedField.required} onCheckedChange={v => updateField(selectedField.id, { required: v })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5"><Label className="text-xs flex items-center gap-1.5"><Key className="h-3 w-3" /> Naming Field</Label><Switch checked={namingFieldId === selectedField.id} onCheckedChange={v => setNamingFieldId(v ? selectedField.id : null)} /></div>
            </CardContent>
          </Card>
        ) : isMulti ? (
          <Card>
            <CardHeader className="py-4"><CardTitle className="text-sm font-semibold text-primary">Bulk Editing</CardTitle><CardDescription className="text-[10px]">{selectedFieldIds.length} selected</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Alignment</Label>
                <div className="grid grid-cols-3 gap-1">
                  {(['left', 'center-h', 'right', 'top', 'center-v', 'bottom'] as const).map(a => (
                    <Button key={a} variant="outline" size="sm" onClick={() => alignFields(a)} className="h-8">
                      {a === 'left' && <AlignStartHorizontal className="h-4 w-4" />}
                      {a === 'center-h' && <AlignCenterHorizontal className="h-4 w-4" />}
                      {a === 'right' && <AlignEndHorizontal className="h-4 w-4" />}
                      {a === 'top' && <AlignStartVertical className="h-4 w-4" />}
                      {a === 'center-v' && <AlignCenterVertical className="h-4 w-4" />}
                      {a === 'bottom' && <AlignEndVertical className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 border-t pt-4"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Distribution</Label>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => distributeFields('horizontal')}><DistributeHorizontal className="h-4 w-4 mr-2"/>Horiz.</Button><Button variant="outline" size="sm" onClick={() => distributeFields('vertical')}><DistributeVertical className="h-4 w-4 mr-2"/>Vert.</Button></div>
              </div>
              <div className="space-y-4 border-t pt-4"><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={() => duplicateFields(selectedFieldIds)}><Copy className="h-3 w-3" /> Duplicate</Button><Button variant="destructive" size="sm" className="h-8 text-xs gap-2" onClick={() => { setFields(p => p.filter(f => !selectedFieldIds.includes(f.id))); setSelectedFieldIds([]); }}><Trash2 className="h-3 w-3" /> Delete</Button></div></div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="py-4"><CardTitle className="text-base font-semibold">Fields ({fields.length})</CardTitle></CardHeader>
              <CardContent className="px-2 pb-2"><SortableFieldList /></CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-4"><CardTitle className="text-sm font-semibold">Document Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3"><Label className="text-xs">Password Protect</Label><Switch checked={passwordProtected} onCheckedChange={setPasswordProtected} /></div>
                {passwordProtected && <div className="relative"><Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="h-8 text-sm pr-8" /><Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button></div>}
                <div className="space-y-2 pt-2 border-t"><Label className="text-xs">Status</Label>
                  <Select value={pdf.status} onValueChange={(v: any) => onStatusChange(v)} disabled={isStatusChanging}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
