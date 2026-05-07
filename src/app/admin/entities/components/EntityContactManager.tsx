'use client';

import * as React from 'react';
import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Trash2, User, Mail, Phone, ShieldCheck, BadgeCheck, X, AlertCircle, Plus, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { getSystemContactTypes } from '@/lib/contact-type-defaults';
import type { ContactTypeEntry, EntityType } from '@/lib/types';

// Fallback used only while the server action is loading
const FALLBACK_ROLES: ContactTypeEntry[] = getSystemContactTypes('institution');

function EntityContactItem({ 
    index, 
    remove, 
    handleSetSignatory,
    handleSetPrimary, 
    fieldsCount,
    availableRoles
}: { 
    index: number; 
    remove: (i: number) => void; 
    handleSetSignatory: (i: number) => void;
    handleSetPrimary: (i: number) => void;
    fieldsCount: number;
    availableRoles: ContactTypeEntry[];
}) {
    const { control, register, watch, formState: { errors } } = useFormContext();
    const isSignatory = watch(`entityContacts.${index}.isSignatory`);
    const isPrimary = watch(`entityContacts.${index}.isPrimary`);
    const currentRoleKey = watch(`entityContacts.${index}.typeKey`);
    const [isCustomRole, setIsCustomRole] = React.useState(!availableRoles.some(r => r.key === currentRoleKey) && !!currentRoleKey);

    const personErrors = (errors.entityContacts as any)?.[index];

    return (
        <Card
            className={cn(
                "border-none ring-1 ring-border shadow-sm overflow-hidden relative group bg-card transition-all duration-500 text-left",
                isSignatory || isPrimary ? "ring-primary/40 bg-primary/[0.04] dark:bg-primary/[0.02] shadow-xl" : "hover:ring-primary/20",
                personErrors && "ring-destructive/50 bg-destructive/5"
            )}
        >
 <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            
 <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {isPrimary && (
                    <Badge className="bg-amber-500 text-white border-none text-[8px] h-5 uppercase px-2 font-semibold gap-1 shadow-lg shadow-amber-500/20 animate-in zoom-in">
                        <User className="h-2.5 w-2.5" aria-hidden="true" /> Primary
                    </Badge>
                )}
                {isSignatory && (
                    <Badge className="bg-primary text-white border-none text-[8px] h-5 uppercase px-2 font-semibold gap-1 shadow-lg shadow-primary/20 animate-in zoom-in">
                        <BadgeCheck className="h-2.5 w-2.5" aria-hidden="true" /> Signatory
                    </Badge>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove Contact"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-destructive/10"
                    onClick={() => remove(index)}
                    disabled={fieldsCount === 1}
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

 <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                        <User className="h-3 w-3 text-primary" /> Full Name
                    </Label>
                    <Input
                        {...register(`entityContacts.${index}.name`)}
                        placeholder="e.g. Ama Serwaa"
                        autoComplete="off"
                        spellCheck={false}
                        className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                            <Mail className="h-3 w-3" /> Email
                        </Label>
                        <Input
                            {...register(`entityContacts.${index}.email`)}
                            type="email"
                            placeholder="ama@school.edu"
                            autoComplete="off"
                            spellCheck={false}
                            className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 font-medium"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                            <Phone className="h-3 w-3" aria-hidden="true" /> Phone
                        </Label>
                        <Input
                            {...register(`entityContacts.${index}.phone`)}
                            placeholder="+233…"
                            inputMode="tel"
                            autoComplete="off"
                            className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="col-span-full space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                            <ShieldCheck className="h-3 w-3" /> Assigned Role
                        </Label>
                        {isCustomRole ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                <Input 
                                    {...register(`entityContacts.${index}.typeLabel`)}
                                    placeholder="Enter custom role…"
                                    autoComplete="off"
                                    className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner font-bold focus-visible:ring-2 focus-visible:ring-primary/20"
                                    autoFocus
                                    onChange={(e) => {
                                        // Update the hidden typeKey when typeLabel changes
                                        const val = e.target.value;
                                        control._formValues.entityContacts[index].typeKey = val.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                    }}
                                />
                                <input type="hidden" {...register(`entityContacts.${index}.typeKey`)} />
                                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setIsCustomRole(false)}><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <Controller
                                name={`entityContacts.${index}.typeKey`}
                                control={control}
                                render={({ field: selectField }) => (
                                    <Select 
                                        onValueChange={(val) => {
                                            if (val === 'CUSTOM') {
                                                setIsCustomRole(true);
                                                // Reset values for custom input
                                                control._formValues.entityContacts[index].typeLabel = '';
                                                control._formValues.entityContacts[index].typeKey = 'custom';
                                            } else {
                                                selectField.onChange(val);
                                                const role = availableRoles.find(r => r.key === val);
                                                if (role) {
                                                    // Sync the label field when key is selected
                                                    control._formValues.entityContacts[index].typeLabel = role.label;
                                                }
                                            }
                                        }} 
                                        value={selectField.value}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus:ring-1 focus:ring-primary/20 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl shadow-2xl border border-border/50 bg-card">
                                            {availableRoles.map((t) => (
                                                <SelectItem key={t.key} value={t.key} className="font-bold text-xs">
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                            <Separator className="my-1" />
                                            <SelectItem value="CUSTOM" className="text-primary font-semibold italic text-xs">Add Custom Role…</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                        {/* Hidden field to ensure typeLabel is submitted when not custom */}
                        {!isCustomRole && <input type="hidden" {...register(`entityContacts.${index}.typeLabel`)} />}
                    </div>

                    <div className="flex flex-col justify-center gap-2 px-1">
                        <Label className="text-[9px] font-bold text-primary tracking-widest uppercase">Primary Contact</Label>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-border/50 shadow-inner transition-all">
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Main Person</span>
                            <Switch 
                                checked={!!isPrimary} 
                                onCheckedChange={() => handleSetPrimary(index)}
                                className="scale-90"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2 px-1">
                        <Label className="text-[9px] font-bold text-primary tracking-widest uppercase">Authorized Signer</Label>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-border/50 shadow-inner transition-all">
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Signer</span>
                            <Switch 
                                checked={!!isSignatory} 
                                onCheckedChange={() => handleSetSignatory(index)}
                                className="scale-90"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface EntityContactManagerProps {
    entityType?: EntityType;
    organizationId?: string;
    workspaceId?: string;
}

export function EntityContactManager({ entityType = 'institution', organizationId, workspaceId }: EntityContactManagerProps) {
  const { control, setValue, watch, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'entityContacts',
  });

  // Dynamic role loading from the 3-level hierarchy
  const [availableRoles, setAvailableRoles] = React.useState<ContactTypeEntry[]>(getSystemContactTypes(entityType));
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingRoles(true);
    getEffectiveContactTypes(entityType, organizationId, workspaceId)
      .then(roles => { if (!cancelled) setAvailableRoles(roles); })
      .catch(() => { if (!cancelled) setAvailableRoles(getSystemContactTypes(entityType)); })
      .finally(() => { if (!cancelled) setIsLoadingRoles(false); });
    return () => { cancelled = true; };
  }, [entityType, organizationId, workspaceId]);

  const contacts = watch('entityContacts') || [];

  const handleSetSignatory = (index: number) => {
    contacts.forEach((_: any, i: number) => {
      setValue(`entityContacts.${i}.isSignatory`, i === index, { shouldDirty: true });
    });
  };

  const handleSetPrimary = (index: number) => {
    contacts.forEach((_: any, i: number) => {
      setValue(`entityContacts.${i}.isPrimary`, i === index, { shouldDirty: true });
    });
  };

  const handleAdd = () => {
    const isFirst = fields.length === 0;
    append({ 
        name: '', 
        email: '', 
        phone: '', 
        typeKey: 'administrator', 
        typeLabel: 'Administrator',
        isSignatory: isFirst,
        isPrimary: isFirst,
        order: fields.length
    });
  };

  return (
 <div className="space-y-6">
 <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Staff & Contacts
                </Label>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Add people who will manage the school system</p>
            </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
                className="h-10 rounded-xl font-bold border-dashed border-2 text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
        >
 <Plus className="h-3.5 w-3.5 mr-1.5" /> New Contact
        </Button>
      </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field, index) => (
          <EntityContactItem 
            key={field.id}
            index={index}
            remove={remove}
            handleSetSignatory={handleSetSignatory}
            handleSetPrimary={handleSetPrimary}
            fieldsCount={fields.length}
            availableRoles={availableRoles}
          />
        ))}
      </div>
      
      {errors.entityContacts?.root?.message && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-pulse" role="alert">
          <AlertCircle className="h-5 w-5 text-rose-500" aria-hidden="true" />
          <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                Contact List Error: {String(errors.entityContacts.root.message)}
            </p>
        </div>
      )}
      {errors.entityContacts?.message && !errors.entityContacts.root && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-pulse" role="alert">
          <AlertCircle className="h-5 w-5 text-rose-500" aria-hidden="true" />
          <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                Contact List Error: {String(errors.entityContacts.message)}
            </p>
        </div>
      )}
    </div>
  );
}
