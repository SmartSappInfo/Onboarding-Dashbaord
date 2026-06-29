import { z } from 'zod';
import { QrCode } from 'lucide-react';
import { EmbeddedQRCode } from '@/components/page-builder/embeds/EmbeddedQRCode';
import { registerBlock } from '../registry';

const schema = z.object({
  qrId: z.string().default('')
});
type QRBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'qr',
  label: 'QR Code',
  category: 'embed',
  icon: QrCode,
  fields: [
    { kind: 'resource', key: 'qrId', label: 'QR Code', resource: 'qr' }
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: QRBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.qrId && ctx.page) {
        return (
          <EmbeddedQRCode 
            qrId={props.qrId} 
            organizationId={ctx.page.organizationId}
            workspaceId={ctx.page.workspaceId}
          />
        );
      }
      return <></>;
    }
    const qr = ctx.resources.qrCodes?.find((q) => q.id === props.qrId);
    return (
      <div className="max-w-md mx-auto p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <QrCode className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Embedded QR Code</h3>
        {qr ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{qr.title}</p>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No QR code selected</p>
        )}
      </div>
    );
  },
});
