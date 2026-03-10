'use client';

import * as React from 'react';
import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, User, Mail, Phone, ShieldCheck, Star, BadgeCheck, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const STANDARD_ROLES = ['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner'] as const;

export function FocalPersonManager() {
  const { control, register, setValue, watch, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'focalPersons',
  });

  const focalPersons = watch('focalPersons') || [];

  // Logic to ensure only one signatory is selected
  const handleSetSignatory = (index: number) => {
    focalPersons.forEach((_: any, i: number) => {
      setValue(`focalPersons.${i}.isSignatory`, i === index, { shouldDirty: true });
    });
  };

  const handleAdd = () => {
    // By default, if it's the first person, they are the signatory
    const isFirst = fields.length === 0;
    append({ 
        name: '', 
        email: '', 
        phone: '', 
        type: 'Administrator', 
        isSignatory: isFirst 
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
        {fields.map((field, index) => {
          const personErrors = (errors.focalPersons as any)?.[index];
          const isSignatory = watch(`focalPersons.${index}.isSignatory`);
          const currentRole = watch(`focalPersons.${index}.type`);
          const [isCustomRole, setIsCustomRole] = React.useState(!STANDARD_ROLES.includes(currentRole as any) && !!currentRole);

          return (
            <Card
              key={field.id}
              className={cn(
                "border-none ring-1 ring-border shadow-sm overflow-hidden relative group bg-background transition-all duration-500",
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
                    disabled={fields.length === 1}
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
              </CardContent>
            </Card>
          );
        })}
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
