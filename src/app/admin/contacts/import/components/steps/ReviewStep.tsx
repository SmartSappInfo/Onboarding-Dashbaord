import React from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, AlertCircle, RefreshCcw } from 'lucide-react';
import Papa from 'papaparse';

interface Props {
  state: ImportState;
  onReset: () => void;
}

export function ReviewStep({ state, onReset }: Props) {
  const result = state.importResult;

  if (!result) return null;

  const handleDownloadErrors = () => {
    if (!result.failedRows.length) return;

    const data = result.failedRows.map((row) => ({
      ...row.originalData,
      _Error_Reason: row.reason,
    }));

    const csvContent = Papa.unparse(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import-errors-${state.entityType}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full items-center justify-center space-y-8 max-w-2xl mx-auto py-8">
      <div className="text-center space-y-3">
        <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Import Completed</h2>
        <p className="text-muted-foreground">Your CSV file has been processed successfully.</p>
      </div>

      <div className="grid grid-cols-3 gap-6 w-full">
        <div className="p-6 rounded-2xl border bg-card/50 text-center shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Successfully Imported</p>
          <p className="text-3xl font-bold text-green-500">{result.successCount.toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-2xl border bg-card/50 text-center shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Skipped (Duplicates)</p>
          <p className="text-3xl font-bold text-amber-500">{result.skippedCount.toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-2xl border bg-card/50 text-center shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Failed Rows</p>
          <p className="text-3xl font-bold text-red-500">{result.errorCount.toLocaleString()}</p>
        </div>
      </div>

      {result.errorCount > 0 && (
        <div className="w-full p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold block">Some rows failed to import</span>
              Download the error report, fix the issues, and re-import just those rows.
            </div>
          </div>
          <Button
            variant="outline"
            className="border-red-500/20 text-red-500 hover:bg-red-500/10 ml-4 flex-shrink-0"
            onClick={handleDownloadErrors}
          >
            <Download className="w-4 h-4 mr-2" /> Error CSV
          </Button>
        </div>
      )}

      <div className="pt-8 w-full">
        <Button onClick={onReset} variant="outline" className="w-full h-12">
          <RefreshCcw className="w-4 h-4 mr-2" /> Start New Import
        </Button>
      </div>
    </div>
  );
}
