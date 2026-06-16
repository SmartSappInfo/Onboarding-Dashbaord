'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

/**
 * Tiny client island for copy-to-clipboard, so the surrounding guide can stay a
 * static Server Component (only this button ships JS).
 */
export default function WhatsAppCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(() => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-background border border-border px-3 py-2 text-[11px] font-mono">{value}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="rounded-lg shrink-0 border-border">
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
