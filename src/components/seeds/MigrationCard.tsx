'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  Database, 
  ShieldCheck, 
  ArrowRightLeft, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  MigrationStatusType,
  FetchResult,
  MigrationResult,
  VerificationResult,
  RollbackResult
} from '@/lib/migration-types';

interface MigrationCardProps {
  featureName: string;
  collectionName: string;
  description: string;
  status: MigrationStatusType;
  totalRecords: number;
  migratedRecords: number;
  unmigratedRecords: number;
  failedRecords: number;
  onFetch: () => Promise<FetchResult>;
  onEnrichAndRestore: () => Promise<MigrationResult>;
  onVerify: () => Promise<VerificationResult>;
  onRollback: () => Promise<RollbackResult>;
}

type OperationState = 'idle' | 'loading' | 'success' | 'error';

export function MigrationCard({
  featureName,
  collectionName,
  description,
  status,
  totalRecords,
  migratedRecords,
  unmigratedRecords,
  failedRecords,
  onFetch,
  onEnrichAndRestore,
  onVerify,
  onRollback
}: MigrationCardProps) {
  const [operationState, setOperationState] = useState<Record<string, OperationState>>({
    fetch: 'idle',
    migrate: 'idle',
    verify: 'idle',
    rollback: 'idle'
  });
  
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);

  const percentage = totalRecords > 0 
    ? Math.round((migratedRecords / totalRecords) * 100) 
    : 0;

  const handleFetch = async () => {
    setOperationState(prev => ({ ...prev, fetch: 'loading' }));
    setErrorLog([]);
    try {
      const result = await onFetch();
      setFetchResult(result);
      setOperationState(prev => ({ ...prev, fetch: 'success' }));
      
      if (result.invalidRecords.length > 0) {
        setErrorLog(result.invalidRecords.map(r => `${r.id}: ${r.reason}`));
      }
    } catch (error) {
      setOperationState(prev => ({ ...prev, fetch: 'error' }));
      setErrorLog([error instanceof Error ? error.message : String(error)]);
    } finally {
      setTimeout(() => setOperationState(prev => ({ ...prev, fetch: 'idle' })), 2000);
    }
  };

  const handleEnrichAndRestore = async () => {
    setOperationState(prev => ({ ...prev, migrate: 'loading' }));
    setErrorLog([]);
    try {
      const result = await onEnrichAndRestore();
      setOperationState(prev => ({ ...prev, migrate: 'success' }));
      
      if (result.errors.length > 0) {
        setErrorLog(result.errors.map(e => `${e.id}: ${e.error}`));
      }
    } catch (error) {
      setOperationState(prev => ({ ...prev, migrate: 'error' }));
      setErrorLog([error instanceof Error ? error.message : String(error)]);
    } finally {
      setTimeout(() => setOperationState(prev => ({ ...prev, migrate: 'idle' })), 2000);
    }
  };

  const handleVerify = async () => {
    setOperationState(prev => ({ ...prev, verify: 'loading' }));
    setErrorLog([]);
    try {
      const result = await onVerify();
      setVerifyResult(result);
      setOperationState(prev => ({ ...prev, verify: 'success' }));
      
      if (result.validationErrors.length > 0) {
        setErrorLog(result.validationErrors.map(e => `${e.recordId} - ${e.field}: ${e.issue}`));
      }
    } catch (error) {
      setOperationState(prev => ({ ...prev, verify: 'error' }));
      setErrorLog([error instanceof Error ? error.message : String(error)]);
    } finally {
      setTimeout(() => setOperationState(prev => ({ ...prev, verify: 'idle' })), 2000);
    }
  };

  const handleRollback = async () => {
    setOperationState(prev => ({ ...prev, rollback: 'loading' }));
    setErrorLog([]);
    try {
      const result = await onRollback();
      setOperationState(prev => ({ ...prev, rollback: 'success' }));
      
      if (result.errors.length > 0) {
        setErrorLog(result.errors.map(e => `${e.id}: ${e.error}`));
      }
    } catch (error) {
      setOperationState(prev => ({ ...prev, rollback: 'error' }));
      setErrorLog([error instanceof Error ? error.message : String(error)]);
    } finally {
      setTimeout(() => setOperationState(prev => ({ ...prev, rollback: 'idle' })), 2000);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'not_started':
        return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Not Started</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-50 text-blue-600 border-blue-200">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-rose-50 text-rose-600 border-rose-200">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
      <CardHeader className="p-6 pb-4 bg-muted/30 border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight">
                {featureName}
              </CardTitle>
              <CardDescription className="text-[10px] font-medium uppercase tracking-tighter mt-1">
                {collectionName}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground mt-3 uppercase tracking-tighter">
          {description}
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Record Counts */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-2xl font-black">{totalRecords}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Migrated</p>
            <p className="text-2xl font-black text-emerald-600">{migratedRecords}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Unmigrated</p>
            <p className="text-2xl font-black text-slate-600">{unmigratedRecords}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">Failed</p>
            <p className="text-2xl font-black text-rose-600">{failedRecords}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Migration Progress
            </p>
            <p className="text-sm font-black text-primary">{percentage}%</p>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleFetch}
            disabled={operationState.fetch === 'loading'}
            variant="outline"
            className="h-11 rounded-xl font-black uppercase text-[10px] border-2"
          >
            {operationState.fetch === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Fetch
          </Button>

          <Button
            onClick={handleEnrichAndRestore}
            disabled={operationState.migrate === 'loading'}
            className="h-11 rounded-xl font-black uppercase text-[10px] bg-primary"
          >
            {operationState.migrate === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-2" />
            )}
            Enrich & Restore
          </Button>

          <Button
            onClick={handleVerify}
            disabled={operationState.verify === 'loading'}
            variant="outline"
            className="h-11 rounded-xl font-black uppercase text-[10px] border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {operationState.verify === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Verify
          </Button>

          <Button
            onClick={handleRollback}
            disabled={operationState.rollback === 'loading'}
            variant="outline"
            className="h-11 rounded-xl font-black uppercase text-[10px] border-2 border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            {operationState.rollback === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Rollback
          </Button>
        </div>

        {/* Fetch Result Display */}
        {fetchResult && (
          <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-900">
                Fetch Results
              </h4>
            </div>
            <div className="text-[9px] font-medium text-blue-700 space-y-1 uppercase tracking-tighter">
              <p>• Total Records: {fetchResult.totalRecords}</p>
              <p>• Records to Migrate: {fetchResult.recordsToMigrate}</p>
              <p>• Invalid Records: {fetchResult.invalidRecords.length}</p>
              {fetchResult.sampleRecords.length > 0 && (
                <p>• Sample: {fetchResult.sampleRecords.length} records fetched</p>
              )}
            </div>
          </div>
        )}

        {/* Verify Result Display */}
        {verifyResult && (
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-900">
                Verification Results
              </h4>
            </div>
            <div className="text-[9px] font-medium text-emerald-700 space-y-1 uppercase tracking-tighter">
              <p>• Total Records: {verifyResult.totalRecords}</p>
              <p>• Migrated: {verifyResult.migratedRecords}</p>
              <p>• Unmigrated: {verifyResult.unmigratedRecords}</p>
              <p>• Orphaned: {verifyResult.orphanedRecords}</p>
              <p>• Validation Errors: {verifyResult.validationErrors.length}</p>
            </div>
          </div>
        )}

        {/* Error Log */}
        {errorLog.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-100 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-900">
                Error Log
              </h4>
            </div>
            <div className="text-[9px] font-mono text-rose-700 space-y-1">
              {errorLog.map((error, index) => (
                <p key={index}>• {error}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
