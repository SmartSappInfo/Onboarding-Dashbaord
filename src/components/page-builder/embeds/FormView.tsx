'use client';

/**
 * Presentational form renderer — no data-fetching. Splitting this from the
 * Firestore-backed `EmbeddedForm` container keeps the form markup + submit
 * behavior unit-testable (no emulator) and reusable across inline + modal hosts.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FormFieldDef {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
}

export interface FormViewProps {
  title: string;
  description?: string;
  fields: FormFieldDef[];
  submitLabel?: string;
  onSubmit: (data: Record<string, string>) => void | Promise<void>;
}

export function FormView({ title, description, fields, submitLabel = 'Submit', onSubmit }: FormViewProps) {
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: Record<string, string> = {};
        formData.forEach((value, key) => {
          data[key] = String(value);
        });
        await onSubmit(data);
      }}
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-semibold">
              {field.label}
              {field.required ? '*' : ''}
            </Label>
            {field.type === 'textarea' ? (
              <textarea
                name={field.id}
                required={field.required}
                placeholder={field.placeholder}
                className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <Input
                name={field.id}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                className="h-12 rounded-xl bg-slate-50 border-slate-200"
              />
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full h-14 rounded-2xl font-black text-base">
        {submitLabel}
      </Button>
    </form>
  );
}
