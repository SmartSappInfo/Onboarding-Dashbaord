'use client';

import * as React from 'react';
import type { PDFForm, WorkspaceEntity, OrgBranding } from '@/lib/types';
import PdfFormRenderer from './PdfFormRenderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Footer from '@/components/footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { SmartSappIcon } from '@/components/icons';
import Image from 'next/image';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

interface PasswordGatedFormProps {
  pdfForm: PDFForm;
  entity?: WorkspaceEntity;
  orgBranding?: OrgBranding | null;
}

export default function PasswordGatedForm({ pdfForm, entity, orgBranding }: PasswordGatedFormProps) {
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = (data: z.infer<typeof passwordSchema>) => {
    if (data.password === pdfForm.password) {
      setIsUnlocked(true);
      setError(null);
    } else {
      setError('Incorrect password. Please try again.');
      form.reset();
    }
  };

  if (isUnlocked) {
    return <PdfFormRenderer pdfForm={pdfForm} entity={entity} orgBranding={orgBranding} />;
  }

  const bgColor = pdfForm.backgroundColor || '#F1F5F9';
  const logoUrl = orgBranding?.logoUrl || entity?.logoUrl || pdfForm.logoUrl;

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div className="flex-grow flex items-center justify-center p-4 relative z-10">
        <Dialog open={!isUnlocked} onOpenChange={(open) => { if (open === false) { /* prevent closing */ } }}>
          <DialogContent showCloseButton={false} className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
            <DialogHeader className="px-6 py-6 border-b border-border/80 bg-muted/20 text-center flex flex-col items-center justify-center space-y-2">
              <div className="flex justify-center mb-2">
                {logoUrl ? (
                    <div className="relative h-12 w-48">
                        <Image src={logoUrl} alt="Logo" fill sizes="192px" className="object-contain" unoptimized={logoUrl.startsWith('http')} />
                    </div>
                ) : (
                    <SmartSappIcon className="h-10 w-10 text-primary" />
                )}
              </div>
              <DialogTitle className="text-center font-bold text-base sm:text-lg tracking-tight text-foreground">{pdfForm.publicTitle || pdfForm.name}</DialogTitle>
              <DialogDescription className="text-center text-xs text-muted-foreground">
                This document from <strong>{entity?.displayName || pdfForm.entityName || 'SmartSapp'}</strong> is password protected.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">Access Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password to unlock..." {...field} className="h-11 rounded-xl bg-background border border-border/80 text-foreground font-medium text-xs min-h-[44px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-xs font-medium text-destructive text-center animate-pulse">{error}</p>}
                <DialogFooter className="pt-2">
                  <Button type="submit" className="w-full h-11 rounded-xl font-medium shadow-sm active:scale-[0.97] transition-all min-h-[44px]" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Unlock Document
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Verifying security gate...</p>
        </div>
      </div>
      
      {orgBranding?.landingPageFooterEnabled !== false && (
        <Footer orgBranding={orgBranding} />
      )}
    </div>
  );
}
