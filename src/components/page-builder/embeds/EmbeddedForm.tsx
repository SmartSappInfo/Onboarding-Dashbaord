'use client';

/**
 * Firestore-backed container for an embedded standalone form. Fetches the form
 * definition, queries workspace app_fields, resolves field properties (labels,
 * placeholders, types), and renders them via `FormView`.
 * 
 * Future reference warning: ensure the firebase rules allow active app_fields to be
 * read by viewers of this page.
 */
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { submitStandaloneFormAction } from '@/lib/form-actions';
import { FormView, type FormFieldDef } from './FormView';
import type { AppField, FormFieldInstance } from '@/lib/types';
import { extractTrackingParams, appendTrackingParams } from '@/lib/tracking-utils';

interface StandaloneForm {
  title: string;
  description?: string;
  fields: FormFieldInstance[];
  settings?: {
    successMessage?: string;
    submitButtonLabel?: string;
    redirectUrl?: string;
  };
}

interface EmbeddedFormProps {
  formId: string;
  pageId?: string;
  organizationId: string;
  workspaceId: string;
  isInModal?: boolean;
  onSuccess?: () => void;
}

export function EmbeddedForm({ formId, pageId, organizationId, workspaceId, isInModal, onSuccess }: EmbeddedFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [form, setForm] = useState<StandaloneForm | null>(null);
  const [appFields, setAppFields] = useState<Record<string, AppField>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!db || !formId || !workspaceId) return;

      try {
        const snap = await getDoc(doc(db, 'forms', formId));
        if (!active) return;

        if (snap.exists()) {
          const formData = snap.data() as StandaloneForm;
          setForm(formData);

          // Fetch app_fields to resolve standard labels and placeholders
          const q = query(
            collection(db, 'app_fields'),
            where('workspaceId', '==', workspaceId),
            where('status', '==', 'active')
          );
          const fieldsSnap = await getDocs(q);
          if (active) {
            const fieldsMap: Record<string, AppField> = {};
            fieldsSnap.docs.forEach((docSnap) => {
              const data = docSnap.data() as AppField;
              fieldsMap[docSnap.id] = { ...data, id: docSnap.id };
            });
            setAppFields(fieldsMap);
          }
        }
      } catch (err) {
        console.error('Failed to fetch form or app fields:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, formId, workspaceId]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  if (!form) return <div className="text-center p-12 text-slate-400">Form not found</div>;

  if (submitted) {
    return (
      <div className="text-center p-12 space-y-4">
        <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{form.settings?.successMessage || 'Thank you!'}</h2>
        <p className="text-slate-500 font-medium">Your response has been recorded successfully.</p>
        {isInModal ? <Button onClick={onSuccess} className="rounded-xl font-bold w-full h-12 mt-4">Close Window</Button> : null}
      </div>
    );
  }

  // Map database form field instances to presentational format with resolved app_fields details
  const resolvedFields: FormFieldDef[] = (form.fields || []).map((f) => {
    const appField = appFields[f.appFieldId];
    return {
      id: f.id,
      label: f.labelOverride || appField?.label || appField?.name || 'Field',
      type: appField?.type || 'short_text',
      placeholder: f.placeholderOverride || appField?.placeholder || '',
      required: f.required
    };
  });

  return (
    <div className={isInModal ? "p-8 sm:p-10" : ""}>
      <FormView
        title={form.title}
        description={form.description}
        fields={resolvedFields}
        submitLabel={form.settings?.submitButtonLabel || 'Submit'}
        onSubmit={async (data) => {
          // Extract tracking parameters from URL, referrer, and sessionStorage
          const extractedTracking = extractTrackingParams();
          const metadata: Record<string, string> = {
            sourcePageId: pageId || '',
            ...extractedTracking,
          };

          const res = await submitStandaloneFormAction(formId, data, workspaceId, organizationId, metadata);
          if (res.success) {
            setSubmitted(true);
            if (form.settings?.redirectUrl) {
              const targetUrl = appendTrackingParams(form.settings.redirectUrl, extractedTracking);
              if (isInModal) {
                if (typeof window !== 'undefined') {
                  window.parent.postMessage({ type: 'smartsapp:redirect', url: targetUrl }, '*');
                }
              } else {
                setTimeout(() => { window.location.href = targetUrl; }, 1500);
              }
            }
          } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
