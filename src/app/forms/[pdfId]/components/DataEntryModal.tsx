'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type PDFForm, type PDFFormField } from '@/lib/types';
import { Check, Info, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';

interface DataEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfForm: PDFForm;
  activeFieldId: string | null;
}

const DatePickerInput = ({ value, onChange, placeholder, disabled, hasError }: { 
    value?: any, 
    onChange: (date?: Date) => void, 
    placeholder?: string,
    disabled?: boolean,
    hasError?: boolean
}) => {
    let dateValue: Date | undefined = undefined;
    if (value) {
        const parsed = value instanceof Date ? value : parseISO(value);
        if (isValid(parsed)) {
            dateValue = parsed;
        }
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    disabled={disabled}
                    className={cn(
                        "w-full h-12 rounded-xl text-base bg-card shadow-sm transition-all justify-start text-left font-normal border-border/50",
                        !dateValue && "text-muted-foreground",
                        hasError && "border-destructive ring-destructive/20"
                    )}
                >
                    <CalendarIcon className="mr-3 h-5 w-5 text-muted-foreground" />
                    {dateValue ? format(dateValue, "PPP") : (placeholder || 'Select date...')}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(d) => onChange(d)}
                  initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}

export default function DataEntryModal({ open, onOpenChange, pdfForm, activeFieldId }: DataEntryModalProps) {
  const { register, control, formState: { errors } } = useFormContext();

  // Filter out signatures and photos as they are handled directly on the document
  const dataFields = React.useMemo(() => 
    pdfForm.fields.filter(f => f.type !== 'signature' && f.type !== 'photo'),
    [pdfForm.fields]
  );

  // Auto-focus logic for the field the user clicked
  const fieldRefs = React.useRef<Record<string, HTMLInputElement | HTMLButtonElement | null>>({});

  React.useEffect(() => {
    if (open && activeFieldId) {
      // Small delay to ensure modal animation is far enough along
      const timer = setTimeout(() => {
        const el = fieldRefs.current[activeFieldId];
        if (el) el.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, activeFieldId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <LayoutList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Fill Form Details</DialogTitle>
              <DialogDescription>Enter the information required for this document.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8 pb-20">
            {dataFields.map((field) => (
              <div 
                key={field.id} 
                className={cn(
                  "space-y-2 transition-all",
                  activeFieldId === field.id && "p-4 bg-primary/5 rounded-xl ring-1 ring-primary/20"
                )}
              >
                <div className="flex justify-between items-center px-1">
                  <Label 
                    htmlFor={field.id} 
                    className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"
                  >
                    {field.label || 'Unnamed Field'}
                    {field.required && <span className="text-destructive font-bold">*</span>}
                  </Label>
                  {errors[field.id] && (
                    <span className="text-[10px] font-bold text-destructive uppercase tracking-tighter">
                      {(errors as any)[field.id]?.message}
                    </span>
                  )}
                </div>

                {field.type === 'dropdown' ? (
                  <Controller
                    name={field.id}
                    control={control}
                    render={({ field: selectField }) => (
                      <Select 
                        onValueChange={selectField.onChange} 
                        value={selectField.value}
                      >
                        <SelectTrigger 
                          ref={(el) => { fieldRefs.current[field.id] = el; }}
                          className={cn("h-12 rounded-xl text-base bg-card border-border/50 shadow-sm", errors[field.id] && "border-destructive")}
                        >
                          <SelectValue placeholder={field.placeholder || "Select an option..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {(field.options || []).map((opt, i) => (
                            <SelectItem key={i} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : field.type === 'date' ? (
                    <Controller
                        name={field.id}
                        control={control}
                        render={({ field: dateField }) => (
                            <DatePickerInput 
                                value={dateField.value} 
                                onChange={(d) => dateField.onChange(d?.toISOString())}
                                placeholder={field.placeholder || field.label}
                                hasError={!!errors[field.id]}
                            />
                        )}
                    />
                ) : (
                  <Input
                    {...register(field.id)}
                    id={field.id}
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'time' ? 'time' : 'text'}
                    placeholder={field.placeholder}
                    className={cn(
                      "h-12 rounded-xl text-base bg-card border-border/50 shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-primary/20",
                      errors[field.id] && "border-destructive focus-visible:ring-destructive/20"
                    )}
                    ref={(el) => { 
                      fieldRefs.current[field.id] = el;
                      // Support both our ref and react-hook-form's ref
                      const { ref } = register(field.id);
                      if (typeof ref === 'function') ref(el);
                    }}
                  />
                )}
              </div>
            ))}

            <div className="p-4 bg-muted/30 border rounded-xl flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Note</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Signatures and photo attachments are handled directly on the document preview after you close this form.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-card shrink-0">
          <Button 
            type="button" 
            onClick={() => onOpenChange(false)} 
            className="w-full h-12 rounded-xl font-bold shadow-lg"
          >
            <Check className="mr-2 h-5 w-5" />
            Apply to Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
