'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { listQRTemplates } from '@/lib/qr-actions';
import { GLOBAL_QR_TEMPLATES } from '@/lib/qr-constants';
import type { QRDesign, QRCodeTemplate } from '@/lib/types';
import QRPreview from '../qr-preview';

interface TemplateControlsProps {
  orgId: string;
  wsId: string;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

export default function TemplateControls({ orgId, wsId, updateDesign }: TemplateControlsProps) {
  const [templates, setTemplates] = React.useState<QRCodeTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await listQRTemplates(orgId, wsId);
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    
    // Listen for new template saves from the designer
    window.addEventListener('qr-template-saved', load);
    return () => window.removeEventListener('qr-template-saved', load);
  }, [orgId, wsId]);

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* System Presets */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-1">System Presets</p>
        <div className="grid grid-cols-2 gap-3">
          {GLOBAL_QR_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => updateDesign(t.design)}
              className="p-2 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all bg-card text-left group"
            >
              <div className="bg-white rounded-lg p-2 mb-2 shadow-sm pointer-events-none flex justify-center border border-border/50 group-hover:border-primary/20">
                <QRPreview data="https://smartsapp.com" design={t.design} size={80} />
              </div>
              <p className="text-[10px] font-semibold text-foreground truncate px-1">{t.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* User Templates */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-1">My Templates</p>
        {templates.length === 0 ? (
          <div className="p-6 border border-dashed border-border rounded-xl bg-muted/10 text-center">
            <p className="text-[11px] text-muted-foreground">No custom templates yet. Save a design to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 pb-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updateDesign(t.design)}
                className="p-2 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all bg-card text-left group"
              >
                <div className="bg-white rounded-lg p-2 mb-2 shadow-sm pointer-events-none flex justify-center border border-border/50 group-hover:border-primary/20">
                  <QRPreview data="https://smartsapp.com" design={t.design} size={80} />
                </div>
                <p className="text-[10px] font-semibold text-foreground truncate px-1">{t.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
