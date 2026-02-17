'use client';

import * as React from 'react';
import type { PDFForm } from '@/lib/types';
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

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

interface PasswordGatedFormProps {
  pdfForm: PDFForm;
}

export default function PasswordGatedForm({ pdfForm }: PasswordGatedFormProps) {
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
    return <PdfFormRenderer pdfForm={pdfForm} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Dialog open={!isUnlocked} onOpenChange={(open) => { if (open === false) { /* prevent closing */ } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <SmartSappIcon className="h-12 w-12 text-primary" />
            </div>
            <DialogTitle className="text-center">Password Required</DialogTitle>
            <DialogDescription className="text-center">
              This document is password protected. Please enter the password to continue.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Unlock Document
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <div className="text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-2">Awaiting password...</p>
      </div>
    </div>
  );
}
