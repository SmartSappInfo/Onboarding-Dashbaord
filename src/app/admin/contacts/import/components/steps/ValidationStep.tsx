import React, { useEffect, useState, useCallback } from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle, CheckCircle, CopyX } from 'lucide-react';
import { validateImportBatch } from '@/lib/import-export/entity-import-actions';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ValidationStep({ state, updateState, onNext, onBack }: Props) {
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  const runValidation = useCallback(async () => {
    if (hasValidated) return;
    setIsValidating(true);
    try {
      const previewBatch = state.csvData.slice(0, 50);

      const results = await validateImportBatch(
        previewBatch,
        state.mappings,
        state.entityType!,
        state.csvData.length,
        state.workspaceId,
        state.organizationId
      );

      updateState({ validationResults: results });
      setHasValidated(true);
    } catch (error) {
      console.error('Validation failed', error);
    } finally {
      setIsValidating(false);
    }
  }, [state.csvData, state.mappings, state.entityType, state.workspaceId, state.organizationId, hasValidated, updateState]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // Reset validation when mappings change
  useEffect(() => {
    setHasValidated(false);
  }, [state.mappings]);

  const stats = state.validationResults;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center">Validate & Preview</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Checking {state.csvData.length.toLocaleString()} rows for errors, missing fields, and duplicates.
          </p>
        </div>
      </div>

      {isValidating ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium animate-pulse">Running data heuristics...</p>
        </div>
      ) : stats ? (
        <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card/50 border rounded-xl p-5 flex items-center space-x-4 shadow-sm">
              <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Valid Rows</p>
                <h4 className="text-2xl font-bold text-foreground">{stats.validRows.toLocaleString()}</h4>
              </div>
            </div>

            <div className="bg-card/50 border rounded-xl p-5 flex items-center space-x-4 shadow-sm">
              <div className="p-3 bg-amber-500/10 rounded-full text-amber-500">
                <CopyX className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Potential Duplicates</p>
                <h4 className="text-2xl font-bold text-foreground">{stats.duplicateRows.toLocaleString()}</h4>
              </div>
            </div>

            <div className="bg-card/50 border rounded-xl p-5 flex items-center space-x-4 shadow-sm">
              <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Errors Detected</p>
                <h4 className="text-2xl font-bold text-foreground">{stats.errorRows.toLocaleString()}</h4>
              </div>
            </div>
          </div>

          {/* Errors List */}
          {stats.errors.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-red-500 flex items-center mb-3">
                <AlertTriangle className="w-4 h-4 mr-2" /> Top Errors
              </h4>
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl overflow-hidden text-sm">
                {stats.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="p-3 border-b border-red-500/10 last:border-0 flex items-start">
                    <span className="font-mono text-xs px-2 py-1 bg-red-500/10 rounded mr-3 mt-0.5">Row {err.rowNumber}</span>
                    <span className="text-red-700 dark:text-red-400">{err.reason}</span>
                  </div>
                ))}
                {stats.errors.length > 5 && (
                  <div className="p-3 text-center text-red-500/70 font-medium">
                    + {stats.errors.length - 5} more errors
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {stats.previewRows.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Data Preview (Sample)</h4>
              <div className="overflow-x-auto border rounded-xl bg-card/50">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {Object.keys(stats.previewRows[0]).map((k) => (
                        <th key={k} className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {stats.previewRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        {Object.values(row).map((v: any, j) => (
                          <td key={j} className="px-4 py-3 truncate max-w-[200px]">
                            {String(v || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex justify-between mt-auto pt-6 border-t">
        <Button variant="ghost" onClick={onBack} disabled={isValidating}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={onNext} disabled={isValidating || !stats || stats.validRows === 0} className="shadow-md">
          Execute Import <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
