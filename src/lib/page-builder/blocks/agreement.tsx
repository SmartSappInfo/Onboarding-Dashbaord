import { z } from 'zod';
import { FileCheck } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({ agreementId: z.string().default('') });
type AgreementBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'agreement',
  label: 'Agreement',
  category: 'embed',
  icon: FileCheck,
  fields: [{ kind: 'resource', key: 'agreementId', label: 'Agreement', resource: 'agreement' }],
  defaults: schema.parse({}),
  schema,
  render: (props: AgreementBlockProps, _block, ctx) => {
    if (ctx.mode === 'view' && !props.agreementId) return <></>;
    const agreement = ctx.resources.agreements.find((a) => a.id === props.agreementId);
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
          <FileCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold">Agreement</h3>
        {agreement ? (
          <p className="text-xs text-slate-500">{agreement.title}</p>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No agreement selected</p>
        )}
      </div>
    );
  },
});
