'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormFieldInstance, AppField } from '@/lib/types';
import { processFormSubmissionAction } from '@/lib/forms-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import FormSuccessScreen from './FormSuccessScreen';

interface ResolvedField extends FormFieldInstance {
  fieldDefinition: AppField;
}

interface FormRendererProps {
  form: Form;
  resolvedFields: ResolvedField[];
  isEmbed?: boolean;
  entityId?: string;
}

export default function FormRenderer({ 
  form, 
  resolvedFields, 
  isEmbed, 
  entityId 
}: FormRendererProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Build Dynamic Zod Schema
  const schemaObject: Record<string, any> = {};
  resolvedFields.forEach((field) => {
    let fieldSchema: any = z.string();
    const type = field.fieldDefinition.type;
    
    if (type === 'email') {
      fieldSchema = z.string().email('Invalid email address');
    } else if (type === 'number' || type === 'currency') {
      fieldSchema = z.preprocess(
        (v) => (v === '' ? undefined : Number(v)),
        z.number({ invalid_type_error: 'Must be a number' })
      );
    } else if (type === 'date') {
      fieldSchema = z.string().min(1, 'Date is required');
    }
    
    if (field.isRequired) {
      if (type !== 'number' && type !== 'currency') {
        fieldSchema = fieldSchema.min(1, `${field.label || field.fieldDefinition.label} is required`);
      }
    } else {
      fieldSchema = fieldSchema.optional().nullable();
    }
    
    schemaObject[field.fieldDefinition.variableName] = fieldSchema;
  });

  const schema = z.object(schemaObject);

  // 2. Initialize Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // 3. Handle Submit
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const result = await processFormSubmissionAction({
        formId: form.id,
        data,
        entityId,
      });

      if (result.success) {
        setIsSubmitted(true);
      } else {
        alert(result.error || 'Failed to submit form');
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <FormSuccessScreen form={form} />;
  }

  // 4. Styles based on Theme
  const theme = form.theme;
  const isGlass = theme.backgroundStyle === 'glass';
  const radiusMap = { none: 'rounded-none', small: 'rounded-md', medium: 'rounded-xl', large: 'rounded-3xl' };
  const cardRadius = radiusMap[theme.borderRadius || 'medium'];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 min-h-screen transition-all duration-500",
      !isEmbed && "bg-slate-50"
    )} style={{ accentColor: theme.accentColor }}>
      
      <div className={cn(
        "w-full transition-all duration-700",
        theme.cardWidth === 'narrow' ? 'max-w-md' : theme.cardWidth === 'wide' ? 'max-w-4xl' : 'max-w-2xl',
        isGlass ? "glass shadow-2xl border border-white/20 p-8 sm:p-12 mb-10" : "bg-white shadow-xl border border-slate-200 p-8 sm:p-12 mb-10",
        cardRadius
      )}>
        
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            {form.title}
          </h1>
          {form.description && (
            <p className="text-slate-500 text-lg">
              {form.description}
            </p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-y-6">
            {resolvedFields.map((field) => {
              const type = field.fieldDefinition.type;
              return (
                <div key={field.id} className="space-y-2">
                  <Label 
                    htmlFor={field.fieldDefinition.variableName} 
                    className="text-sm font-semibold text-slate-700 ml-1"
                  >
                    {field.label || field.fieldDefinition.label}
                    {field.isRequired && <span className="text-rose-500 ml-1">*</span>}
                  </Label>
                  
                  {type === 'long_text' ? (
                    <Textarea
                      id={field.fieldDefinition.variableName}
                      placeholder={field.placeholder || field.fieldDefinition.placeholder}
                      {...register(field.fieldDefinition.variableName)}
                      className={cn(
                        "min-h-[120px] transition-all focus:ring-2",
                        isGlass ? "bg-white/50 border-white/30" : "bg-slate-50 border-slate-200",
                        errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200"
                      )}
                    />
                  ) : (
                    <Input
                      id={field.fieldDefinition.variableName}
                      type={
                        type === 'email' ? 'email' : 
                        type === 'phone' ? 'tel' : 
                        type === 'number' || type === 'currency' ? 'number' : 
                        type === 'date' ? 'date' :
                        'text'
                      }
                      placeholder={field.placeholder || field.fieldDefinition.placeholder}
                      {...register(field.fieldDefinition.variableName)}
                      className={cn(
                        "h-12 transition-all focus:ring-2",
                        isGlass ? "bg-white/50 border-white/30" : "bg-slate-50 border-slate-200",
                        errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200"
                      )}
                    />
                  )}
                  
                  {errors[field.fieldDefinition.variableName] && (
                    <p className="text-xs font-bold text-rose-500 mt-1 ml-1 uppercase tracking-tighter">
                      {(errors[field.fieldDefinition.variableName] as any)?.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-14 text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
                "hover:shadow-xl group"
              )}
              style={{ backgroundColor: theme.accentColor }}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <>
                  {theme.ctaLabel || 'Submit Form'}
                  <Send className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Branding */}
        {!isEmbed && (
          <div className="mt-12 text-center text-slate-400 text-xs font-medium uppercase tracking-widest flex items-center justify-center gap-2">
            <span>Powered by</span>
            <span className="text-slate-600 font-bold">SmartSapp</span>
          </div>
        )}
      </div>
    </div>
  );
}
