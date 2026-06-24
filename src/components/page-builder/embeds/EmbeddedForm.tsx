'use client';

/**
 * Firestore-backed container for an embedded standalone form. Fetches the form
 * definition, renders it via `FormView`, and submits through the existing
 * `submitStandaloneFormAction` (which also drives downstream automations).
 *
 * NOTE: `PublicPageClient` still has an inline copy of this used by its modal;
 * Phase 4 replaces that with this shared component (then the duplicate is gone).
 */
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { submitStandaloneFormAction } from '@/lib/form-actions';
import { FormView, type FormFieldDef } from './FormView';

interface StandaloneForm {
  title: string;
  description?: string;
  fields: FormFieldDef[];
  settings?: {
    successMessage?: string;
    submitButtonLabel?: string;
    redirectUrl?: string;
  };
}

interface EmbeddedFormProps {
  formId: string;
  pageId: string;
  organizationId: string;
  workspaceId: string;
  isInModal?: boolean;
  onSuccess?: () => void;
}

export function EmbeddedForm({ formId, pageId, organizationId, workspaceId, isInModal, onSuccess }: EmbeddedFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [form, setForm] = useState<StandaloneForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const snap = await getDoc(doc(db, 'standaloneForms', formId));
      if (active) {
        if (snap.exists()) setForm(snap.data() as StandaloneForm);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, formId]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  if (!form) return <div className="text-center p-12 text-slate-400">Form not found</div>;

  if (submitted) {
    return (
      <div className="text-center p-12 space-y-4">
        <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">{form.settings?.successMessage || 'Thank you!'}</h2>
        <p className="text-slate-500 font-medium">Your response has been recorded successfully.</p>
        {isInModal ? <Button onClick={onSuccess} className="rounded-xl font-bold w-full h-12 mt-4">Close Window</Button> : null}
      </div>
    );
  }

  return (
    <FormView
      title={form.title}
      description={form.description}
      fields={form.fields}
      submitLabel={form.settings?.submitButtonLabel || 'Submit'}
      onSubmit={async (data) => {
        const res = await submitStandaloneFormAction(formId, data, workspaceId, organizationId, { sourcePageId: pageId });
        if (res.success) {
          setSubmitted(true);
          if (!isInModal && form.settings?.redirectUrl) {
            setTimeout(() => { window.location.href = form.settings!.redirectUrl!; }, 2000);
          }
        } else {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
      }}
    />
  );
}
