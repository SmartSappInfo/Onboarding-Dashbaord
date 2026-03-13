'use client';

import * as React from 'react';
import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Trash2, Plus, User, Mail, Phone, ShieldCheck, BadgeCheck, X, AlertCircle, 
    ChevronDown, ChevronUp, StickyNote, Paperclip, FileText, PlusCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MediaSelect } from './media-select';
import { motion, AnimatePresence } from 'framer-motion';

const STANDARD_ROLES = ['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner'] as const;

function FocalPersonItem({ 
    index, 
    remove, 
    handleSetSignatory, 
    fieldsCount 
}: { 
    index: number; 
    remove: (i: number) => void; 
    handleSetSignatory: (i: number) => void;
    fieldsCount: number;
}) {
    const { control, register, watch, formState: { errors }, setValue } = useFormContext();
    const isSignatory = watch(`focalPersons.${index}.isSignatory`);
    const currentRole = watch(`focalPersons.${index}.type`);
    const [isCustomRole, setIsCustomRole] = React.useState(!STANDARD_ROLES.includes(currentRole as any) && !!currentRole);
    const [isExpanded, setIsExpanded] = React.useState(false);

    const personErrors = (errors.focalPersons as any)?.[index];

    // Nested Field Arrays for Notes & Attachments
    const { fields: notes, append: appendNote, remove: removeNote } = useFieldArray({
        control,
        name: `focalPersons.${index}.notes`
    });

    const { fields: attachments, append: appendAttachment, remove: removeAttachment } = useFieldArray({
        control,
        name: `focalPersons.${index}.attachments`
    });

    const [newNote, setNewNote] = React.useState('');

    const handleAddAttachment = (url: string) => {
        if (!url) return;
        const fileName = url.split('/').pop()?.split('?')[0] || 'document';
        const decodedName = decodeURIComponent(fileName).substring(fileName.indexOf('-') + 1);
        appendAttachment({
            id: `att_${Date.now()}`,
            name: decodedName,
            url,
            type: 'document',
            createdAt: new Date().toISOString()
        });
    };

    return (
        <Card
            className={cn(
                "border-none ring-1 ring-border shadow-sm overflow-hidden relative group bg-background transition-all duration-500 text-left",
                isSignatory ? "ring-primary/40 bg-primary/[0.02] shadow-xl" : "hover:ring-primary/20",
                personErrors && "ring-destructive/50 bg-destructive/5"
            )}
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute top-3 right-3 flex items-center gap-2">
                {isSignatory && (
                    <Badge className="bg-primary text-white border-none text-[8px] h-5 uppercase px-2 font-black gap-1 shadow-lg shadow-primary/20 animate-in zoom-in">
                        <BadgeCheck className="h-2.5 w-2.5" /> Signatory
                    </Badge>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-destructive/10"
                    onClick={() => remove(index)}
                    disabled={fieldsCount === 1}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                        <User className="h-3 w-3 text-primary" /> Full Name
                    </Label>
                    <Input
                        {...register(`focalPersons.${index}.name`)}
                        placeholder="e.g. Ama Serwaa"
                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                            <Mail className="h-3 w-3" /> Email
                        </Label>
                        <Input
                            {...register(`focalPersons.${index}.email`)}
                            type="email"
                            placeholder="ama@school.edu"
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                            <Phone className="h-3 w-3" /> Phone
                        </Label>
                        <Input
                            {...register(`focalPersons.${index}.phone`)}
                            placeholder="+233..."
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                            <ShieldCheck className="h-3 w-3" /> Authority Role
                        </Label>
                        {isCustomRole ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                <Input 
                                    {...register(`focalPersons.${index}.type`)}
                                    placeholder="Enter custom role..."
                                    className="h-10 rounded-xl bg-muted/20 border-none font-bold"
                                    autoFocus
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setIsCustomRole(false)}><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <Controller
                                name={`focalPersons.${index}.type`}
                                control={control}
                                render={({ field: selectField }) => (
                                    <Select 
                                        onValueChange={(val) => {
                                            if (val === 'CUSTOM') setIsCustomRole(true);
                                            else selectField.onChange(val);
                                        }} 
                                        value={selectField.value}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl shadow-2xl border-none">
                                            {STANDARD_ROLES.map((t) => (
                                                <SelectItem key={t} value={t} className="font-bold">
                                                    {t}
                                                </SelectItem>
                                            ))}
                                            <Separator className="my-1" />
                                            <SelectItem value="CUSTOM" className="text-primary font-black italic">Add Custom Role...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                    </div>

                    <div className="flex flex-col justify-center gap-2 px-1">
                        <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Legal Signatory Status</Label>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border shadow-inner transition-all">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Authorized</span>
                            <Switch 
                                checked={!!isSignatory} 
                                onCheckedChange={() => handleSetSignatory(index)}
                                className="scale-90"
                            />
                        </div>
                    </div>
                </div>

                {/* Ledger & Assets Toggle */}
                <div className="pt-2">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full h-10 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-muted/10 hover:bg-muted/30"
                    >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? 'Hide Ledger & Assets' : `Manage History (${notes.length + attachments.length})`}
                    </Button>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-8 pt-4 border-t border-dashed"
                        >
                            {/* Notes Sub-section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <StickyNote className="h-3 w-3" /> Internal Ledger
                                    </Label>
                                    <Badge variant="outline" className="text-[8px] font-black">{notes.length}</Badge>
                                </div>
                                <div className="flex gap-2">
                                    <Input 
                                        value={newNote} 
                                        onChange={e => setNewNote(e.target.value)}
                                        placeholder="Quick context note..."
                                        className="h-9 rounded-lg bg-muted/20 border-none shadow-inner text-xs"
                                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newNote.trim()) { appendNote({ id: `n_${Date.now()}`, content: newNote.trim(), createdAt: new Date().toISOString() }); setNewNote(''); } } }}
                                    />
                                    <Button type="button" size="icon" className="h-9 w-9 rounded-lg bg-primary text-white shadow-md" onClick={() => { if(newNote.trim()) { appendNote({ id: `n_${Date.now()}`, content: newNote.trim(), createdAt: new Date().toISOString() }); setNewNote(''); } }}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {notes.map((note, nIdx) => (
                                        <div key={note.id} className="p-3 rounded-xl bg-muted/10 border relative group/note">
                                            <p className="text-[10px] font-medium leading-relaxed pr-6">{note.content}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1 opacity-40">{format(new Date(note.createdAt), 'MMM d, HH:mm')}</p>
                                            <button type="button" onClick={() => removeNote(nIdx)} className="absolute top-2 right-2 text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity"><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Attachments Sub-section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Paperclip className="h-3 w-3" /> Credentials
                                    </Label>
                                    <Badge variant="outline" className="text-[8px] font-black">{attachments.length}</Badge>
                                </div>
                                <div className="p-1 border-2 border-dashed border-primary/10 rounded-xl">
                                    <MediaSelect 
                                        onValueChange={handleAddAttachment}
                                        className="border-none shadow-none bg-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {attachments.map((att, aIdx) => (
                                        <div key={att.id} className="flex items-center justify-between p-2 rounded-lg bg-white border shadow-sm group/att">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-3 w-3 text-primary" />
                                                <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">{att.name}</span>
                                            </div>
                                            <button type="button" onClick={() => removeAttachment(aIdx)} className="text-destructive opacity-0 group-hover/att:opacity-100 transition-opacity"><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

export function FocalPersonManager() {
  const { control, setValue, watch, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'focalPersons',
  });

  const focalPersons = watch('focalPersons') || [];

  const handleSetSignatory = (index: number) => {
    focalPersons.forEach((_: any, i: number) => {
      setValue(`focalPersons.${i}.isSignatory`, i === index, { shouldDirty: true });
    });
  };

  const handleAdd = () => {
    const isFirst = fields.length === 0;
    append({ 
        name: '', 
        email: '', 
        phone: '', 
        type: 'Administrator', 
        isSignatory: isFirst,
        notes: [],
        attachments: []
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="space-y-0.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-primary">
                Staff Directory
            </Label>
            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Identify institutional stakeholders</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-9 rounded-xl font-black border-dashed border-2 text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field, index) => (
          <FocalPersonItem 
            key={field.id}
            index={index}
            remove={remove}
            handleSetSignatory={handleSetSignatory}
            fieldsCount={fields.length}
          />
        ))}
      </div>
      
      {errors.focalPersons?.message && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3 animate-pulse">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <p className="text-[10px] font-black uppercase text-rose-900 tracking-widest">
                Logic Integrity Failure: {String(errors.focalPersons.message)}
            </p>
        </div>
      )}
    </div>
  );
}
