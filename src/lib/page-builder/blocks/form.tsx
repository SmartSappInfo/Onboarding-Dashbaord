import { z } from 'zod';
import { ClipboardList } from 'lucide-react';
import { EmbeddedForm } from '@/components/page-builder/embeds/EmbeddedForm';
import { registerBlock } from '../registry';

const schema = z.object({ formId: z.string().default('') });
type FormBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'form',
  label: 'Form',
  category: 'embed',
  icon: ClipboardList,
  fields: [{ kind: 'resource', key: 'formId', label: 'Form', resource: 'form' }],
  defaults: schema.parse({}),
  schema,
  render: (props: FormBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.formId && ctx.page) {
        return (
          <EmbeddedForm
            formId={props.formId}
            pageId={ctx.page.id}
            organizationId={ctx.page.organizationId}
            workspaceId={ctx.page.workspaceId}
          />
        );
      }
      return <></>;
    }

    const form = ctx.resources.forms.find((f) => f.id === props.formId);
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
          <ClipboardList className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-bold">Embedded Form</h3>
        {form ? (
          <p className="text-xs text-slate-500">{form.internalName || form.title}</p>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No form selected</p>
        )}
      </div>
    );
  },
});
