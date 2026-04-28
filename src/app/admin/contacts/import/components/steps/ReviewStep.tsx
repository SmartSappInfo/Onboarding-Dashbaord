import React from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, AlertCircle, RefreshCcw, ArrowRight, XCircle, SkipForward, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

interface Props {
  state: ImportState;
  onReset: () => void;
}

export function ReviewStep({ state, onReset }: Props) {
  const result = state.importResult;
  const router = useRouter();

  if (!result) return null;

  const total = result.successCount + result.errorCount + result.skippedCount;
  const successRate = total > 0 ? Math.round((result.successCount / total) * 100) : 0;

  const handleDownloadErrors = () => {
    if (!result.failedRows.length) return;

    const data = result.failedRows.map((row) => ({
      _Row: row.rowNumber,
      _Error_Reason: row.reason,
      ...row.originalData,
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

  const isFullSuccess = result.successCount > 0 && result.errorCount === 0 && result.skippedCount === 0;
  const isFullFailure = result.successCount === 0;

  return (
    <div className="flex flex-col h-full space-y-6 max-w-3xl mx-auto py-6">
      {/* Header Banner */}
      <div className={`relative overflow-hidden rounded-2xl p-8 ${
        isFullSuccess ? 'bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-teal-500/5 border border-emerald-500/30'
        : isFullFailure ? 'bg-gradient-to-br from-red-500/20 via-red-500/10 to-orange-500/5 border border-red-500/30'
        : 'bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/5 border border-amber-500/30'
      }`}>
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            isFullSuccess ? 'bg-emerald-500' : isFullFailure ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {isFullSuccess ? <CheckCircle2 className="w-8 h-8 text-white" /> 
             : isFullFailure ? <XCircle className="w-8 h-8 text-white" />
             : <AlertTriangle className="w-8 h-8 text-white" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Import Report
            </h2>
            <p className="text-muted-foreground mt-1 font-medium">
              {result.successCount.toLocaleString()} {result.successCount === 1 ? 'record' : 'records'} synchronized
              {result.errorCount > 0 && ` · ${result.errorCount} failed`}
              {result.skippedCount > 0 && ` · ${result.skippedCount} skipped`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border bg-card shadow-sm text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Success Rate</p>
          <p className={`text-3xl font-black ${successRate >= 80 ? 'text-emerald-500' : successRate > 0 ? 'text-amber-500' : 'text-red-500'}`}>
            {successRate}%
          </p>
        </div>
        <div className="p-5 rounded-xl border bg-card shadow-sm text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Created</p>
          <p className="text-3xl font-black text-emerald-500">{result.successCount.toLocaleString()}</p>
        </div>
        <div className="p-5 rounded-xl border bg-card shadow-sm text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Skipped</p>
          <p className="text-3xl font-black text-amber-500">{result.skippedCount.toLocaleString()}</p>
        </div>
        <div className="p-5 rounded-xl border bg-card shadow-sm text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Failed</p>
          <p className="text-3xl font-black text-red-500">{result.errorCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Error Details */}
      {result.failedRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Error Details ({result.failedRows.length} {result.failedRows.length === 1 ? 'row' : 'rows'})
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
              onClick={handleDownloadErrors}
            >
              <Download className="w-3 h-3 mr-1.5" /> Export Error CSV
            </Button>
          </div>
          <div className="border rounded-xl overflow-hidden bg-card">
            <div className="max-h-[200px] overflow-y-auto">
              {result.failedRows.slice(0, 20).map((row, idx) => (
                <div key={idx} className={`flex items-start gap-3 px-4 py-3 text-xs ${idx > 0 ? 'border-t' : ''}`}>
                  <span className="font-mono font-bold text-muted-foreground min-w-[40px] shrink-0">
                    R{row.rowNumber}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium leading-relaxed break-all">
                    {row.reason}
                  </span>
                </div>
              ))}
              {result.failedRows.length > 20 && (
                <div className="px-4 py-3 border-t text-xs text-muted-foreground text-center italic">
                  ... and {result.failedRows.length - 20} more. Download the CSV to see all.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onReset} variant="outline" className="flex-1 h-12">
          <RefreshCcw className="w-4 h-4 mr-2" /> Start New Import
        </Button>
        <Button onClick={() => router.push('/admin/entities')} className="flex-1 h-12 shadow-lg">
          Open Directory <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
