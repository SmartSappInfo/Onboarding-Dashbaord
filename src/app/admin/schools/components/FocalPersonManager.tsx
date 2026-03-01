
'use client';

import * as React from 'react';
import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, User, Mail, Phone, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FOCAL_PERSON_TYPES = ['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner'] as const;

export function FocalPersonManager() {
  const { control, register, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'focalPersons',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          Staff Focal Persons
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: '', email: '', phone: '', type: 'Administrator' })}
          className="h-8 rounded-lg font-bold border-dashed border-2 text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all"
        >
          <Plus className="h-3 w-3 mr-1.5" /> Add Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field, index) => {
          const personErrors = (errors.focalPersons as any)?.[index];
          
          return (
            <Card
              key={field.id}
              className={cn(
                "border-none ring-1 ring-border shadow-sm overflow-hidden relative group bg-background transition-all",
                personErrors && "ring-destructive/50 bg-destructive/5"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                    <User className="h-3 w-3" /> Full Name
                  </Label>
                  <Input
                    {...register(`focalPersons.${index}.name`)}
                    placeholder="e.g. John Doe"
                    className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    <Input
                      {...register(`focalPersons.${index}.email`)}
                      type="email"
                      placeholder="john@school.edu"
                      className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                      <Phone className="h-3 w-3" /> Phone
                    </Label>
                    <Input
                      {...register(`focalPersons.${index}.phone`)}
                      placeholder="+233..."
                      className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1.5 ml-1">
                    <ShieldCheck className="h-3 w-3" /> Authority Role
                  </Label>
                  <Controller
                    name={`focalPersons.${index}.type`}
                    control={control}
                    render={({ field: selectField }) => (
                      <Select onValueChange={selectField.onChange} value={selectField.value}>
                        <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {FOCAL_PERSON_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {errors.focalPersons?.message && (
        <p className="text-[10px] font-bold text-destructive uppercase tracking-widest px-2 animate-pulse">
          {String(errors.focalPersons.message)}
        </p>
      )}
    </div>
  );
}
