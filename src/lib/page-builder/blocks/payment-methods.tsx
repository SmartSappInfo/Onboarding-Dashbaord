import { z } from 'zod';
import { Banknote } from 'lucide-react';
import { registerBlock } from '../registry';

const detail = z.object({ label: z.string().default(''), value: z.string().default('') });
const method = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
  details: z.array(detail).default([]),
});
const schema = z.object({ methods: z.array(method).default([]) });
type PaymentMethodsProps = z.infer<typeof schema>;

const FALLBACK_ICON = 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png';

registerBlock({
  type: 'payment_methods',
  label: 'Payment Methods',
  category: 'data',
  icon: Banknote,
  fields: [],
  defaults: schema.parse({}),
  schema,
  render: (props: PaymentMethodsProps, _block, ctx) => {
    if (props.methods.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4">No payment methods configured</p>;
    }
    return (
      <div className="grid grid-cols-1 gap-6">
        {props.methods.map((m, mi) => (
          <div key={mi} className="p-8 rounded-2xl bg-black/[0.02] border border-black/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.icon || FALLBACK_ICON} alt={m.name || m.title || 'Payment method'} className="w-8 h-8 object-contain" />
              </div>
              <span className="font-bold text-lg tracking-tight" style={{ color: ctx.theme.colors.text }}>{m.name || m.title}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {m.details.map((d, di) => (
                <div key={di} className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ctx.theme.colors.text, opacity: 0.5 }}>{d.label}</span>
                  <span className="text-lg font-bold tracking-tight" style={{ color: ctx.theme.colors.text }}>{ctx.interpolate(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
});
