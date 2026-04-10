'use client';

import * as React from 'react';
import type { PDFForm, School } from '@/lib/types';
import PdfFormRenderer from './PdfFormRenderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  school?: School;
}

export default function PasswordGatedForm({ pdfForm, school }: PasswordGatedFormProps) {
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
    return <PdfFormRenderer pdfForm={pdfForm} school={school} />;
  }

  const bgColor = pdfForm.backgroundColor || '#F1F5F9';
  const logoUrl = school?.logoUrl || pdfForm.logoUrl;

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div className="flex-grow flex items-center justify-center p-4 relative z-10">
        <Dialog open={!isUnlocked} onOpenChange={(open) => { if (open === false) { /* prevent closing */ } }}>
          <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl overflow-hidden p-0">
            <DialogHeader className="p-8 bg-muted/30 border-b">
              <div className="flex justify-center mb-4">
                {logoUrl ? (
                    <div className="relative h-12 w-48">
                        <Image src={logoUrl} alt="Logo" fill className="object-contain" />
                    </div>
                ) : (
                    <SmartSappIcon className="h-12 w-12 text-primary" />
                )}
              </div>
              <DialogTitle className="text-center font-black uppercase tracking-tight">{pdfForm.publicTitle || pdfForm.name}</DialogTitle>
              <DialogDescription className="text-center text-xs font-medium uppercase tracking-widest">
                This document from <strong>{school?.name || pdfForm.entityName || 'SmartSapp'}</strong> is password protected.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-8">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Access Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password to unlock..." {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-sm font-bold text-destructive text-center animate-pulse">{error}</p>}
                <DialogFooter>
                  <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all" disabled={form.formState.isSubmitting}>
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
      
      <footer className="py-8 text-center text-xs sm:text-sm text-muted-foreground bg-white/50 border-t relative z-10">
          <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
          <p>&copy; {new Date().getFullYear()} SmartSapp</p>
      </footer>
    </div>
  );
}
