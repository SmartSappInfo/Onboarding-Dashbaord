'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportSubmissionsAsCsvAction } from '@/lib/forms-actions';
import { useToast } from '@/hooks/use-toast';

interface Props {
  formId: string;
}

export default function ExportButton({ formId }: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportSubmissionsAsCsvAction(formId);

      if (!result.success) {
        toast({ variant: 'destructive', title: 'Export failed', description: result.error });
        return;
      }

      // Trigger browser file download from the CSV string
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: `Saved as ${result.filename}` });
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 rounded-lg font-medium"
      onClick={handleExport}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {isPending ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
