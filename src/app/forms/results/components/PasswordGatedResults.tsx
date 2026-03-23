'use client';

import * as React from 'react';
import type { PDFForm } from '@/lib/types';
import SharedResultsListView from './SharedResultsListView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Lock } from 'lucide-react';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

const AUTH_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export default function PasswordGatedResults({ pdfForm }: { pdfForm: PDFForm }) {
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const storageKey = React.useMemo(() => `results_auth_${pdfForm.id}`, [pdfForm.id]);

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  React.useEffect(() => {
    const checkAuth = () => {
      // If no password is set, skip the gate
      if (!pdfForm.resultsPassword) {
        setIsUnlocked(true);
        setIsInitializing(false);
        return;
      }

      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const { timestamp } = JSON.parse(stored);
          if (Date.now() - timestamp < AUTH_EXPIRY_MS) {
            setIsUnlocked(true);
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          localStorage.removeItem(storageKey);
        }
      }
      setIsInitializing(false);
    };

    checkAuth();
  }, [storageKey, pdfForm.resultsPassword]);

  const onSubmit = (data: z.infer<typeof passwordSchema>) => {
    if (data.password === pdfForm.resultsPassword) {
      localStorage.setItem(storageKey, JSON.stringify({ timestamp: Date.now() }));
      setIsUnlocked(true);
      setError(null);
    } else {
      setError('Incorrect password. Please try again.');
      form.reset();
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isUnlocked) {
    return <SharedResultsListView pdfForm={pdfForm} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <Dialog open={!isUnlocked} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => e.preventDefault()} 
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Lock className="h-10 w-10 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Shared Results Access</DialogTitle>
            <DialogDescription className="text-center">
              Please enter the password provided to you to view the submissions for <strong>"{pdfForm.name}"</strong>.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Results Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <p className="text-sm font-medium text-destructive text-center">{error}</p>}
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Access Results
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
