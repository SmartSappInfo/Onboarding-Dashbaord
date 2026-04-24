import React, { useEffect, useState, useRef } from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { executeImportBatch } from '@/lib/import-export/entity-import-actions';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
}

export function ExecutionStep({ state, updateState, onNext }: Props) {
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [statusText, setStatusText] = useState('Initializing import...');
  const executingRef = useRef(false);

  useEffect(() => {
    if (executingRef.current) return;
    executingRef.current = true;

    async function processImport() {
      const BATCH_SIZE = 50;
      const dataToImport = state.csvData;
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const failedRows: Array<{ rowNumber: number; reason: string; originalData: Record<string, string> }> = [];

      for (let i = 0; i < dataToImport.length; i += BATCH_SIZE) {
        const batch = dataToImport.slice(i, i + BATCH_SIZE);
        const batchEnd = Math.min(i + BATCH_SIZE, dataToImport.length);
        setStatusText(`Processing rows ${i + 1} to ${batchEnd}...`);

        try {
          const result = await executeImportBatch(
            batch,
            state.mappings,
            state.entityType!,
            state.workspaceId,
            state.organizationId,
            state.userId,
            state.pipelineId,
            state.stageId,
            state.configuration
          );

          successCount += result.successCount;
          errorCount += result.errorCount;
          skippedCount += result.skippedCount;

          if (result.failedRows) {
            // Adjust row numbers to be global (not batch-local)
            failedRows.push(
              ...result.failedRows.map((r) => ({
                ...r,
                rowNumber: i + r.rowNumber,
              }))
            );
          }
        } catch (error) {
          console.error('Batch failure', error);
          errorCount += batch.length;
          batch.forEach((row, idx) => {
            failedRows.push({
              rowNumber: i + idx + 1,
              reason: 'Network/Server failure during batch execution',
              originalData: row,
            });
          });
        }

        setProgress(Math.round((batchEnd / dataToImport.length) * 100));
      }

      setStatusText('Finalizing import logs...');

      updateState({
        importResult: {
          successCount,
          errorCount,
          skippedCount,
          failedRows,
        },
      });

      setProgress(100);
      setIsDone(true);
      setStatusText('Import complete!');
    }

    processImport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full items-center justify-center max-w-xl mx-auto space-y-8 py-12">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {isDone ? (
          <div className="absolute inset-0 bg-green-500/10 rounded-full animate-in zoom-in duration-500 flex items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div
              className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"
              style={{ animationDuration: '3s' }}
            ></div>
            <Database className="w-10 h-10 text-primary animate-pulse" />
          </>
        )}
      </div>

      <div className="text-center space-y-2 w-full">
        <h3 className="text-2xl font-bold text-foreground">{isDone ? 'Import Successful' : 'Importing Data'}</h3>
        <p className={`text-muted-foreground font-medium ${isDone ? '' : 'animate-pulse'}`}>{statusText}</p>
      </div>

      <div className="w-full space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-primary">{Math.min(progress, 100)}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {isDone && (
        <div className="pt-8 w-full animate-in slide-in-from-bottom-4 duration-500">
          <Button onClick={onNext} className="w-full h-12 shadow-lg">
            View Review & Summary <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
