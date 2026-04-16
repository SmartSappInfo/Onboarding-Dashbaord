'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { migrateContractsToEntities, rollbackContractsMigration } from '@/lib/entity-migrations';
import { Loader2, Zap, RotateCcw, FileCheck, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';

export default function SeedsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId } = useTenant();
  
  const [migrationStatus, setMigrationStatus] = useState<SeedingState>('idle');
  const [rollbackStatus, setRollbackStatus] = useState<SeedingState>('idle');

  const handleMigration = async () => {
    if (!firestore) return;
    setMigrationStatus('seeding');
    try {
      await migrateContractsToEntities(firestore);
      toast({ title: 'Agreements Name-Mapped Successfully!' });
      setMigrationStatus('success');
    } catch (error: any) {
      setMigrationStatus('error');
      toast({ variant: 'destructive', title: 'Migration Failed', description: error.message });
    } finally {
      setTimeout(() => setMigrationStatus('idle'), 2500);
    }
  };

  const handleRollback = async () => {
    if (!firestore) return;
    setRollbackStatus('seeding');
    try {
      await rollbackContractsMigration(firestore);
      toast({ title: 'Rollback Completed', description: 'Restored contracts to legacy format.' });
      setRollbackStatus('success');
    } catch (error: any) {
      setRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setRollbackStatus('idle'), 2500);
    }
  };

  return (
    <div className="min-h-full bg-background relative overflow-y-auto w-full flex justify-center pb-20">
        <main className="max-w-4xl w-full p-4 lg:p-10 space-y-16">
            
            {/* Header */}
            <div>
                <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px]">Workspace Integrations</Badge>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Seeding Actions</h1>
                <p className="text-muted-foreground font-medium md:text-lg">
                    Execute core schema enrichments and cross-workspace mappings.
                </p>
            </div>

            {/* Core Migrations */}
            <section className="space-y-6">
                <div className="flex flex-col gap-1 items-start mb-6">
                    <h3 className="text-2xl font-bold tracking-tight">Active Protocols</h3>
                    <p className="text-muted-foreground font-medium">Currently active Fetch, Enrich, and Restore (FER) streams.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <SimpleMigrationCard 
                        title="Agreements Name Mapping (FER)"
                        description="Fetches all global contracts, maps them to their respective Unified Entities by comparing 'schoolName', and restores the corrected 'entityId' and 'entityName' properties. Resolves missing Agreements views."
                        icon={FileCheck}
                        status={migrationStatus}
                        onSync={handleMigration}
                        onRollback={handleRollback}
                    />
                </div>
            </section>
        </main>
    </div>
  );
}

// Simple migration card for basic seed operations
function SimpleMigrationCard({ title, description, onSync, onRollback, status, icon: Icon }: {
  title: string;
  description: string;
  onSync: () => void;
  onRollback?: () => void;
  status: SeedingState;
  icon: any;
}) {
    return (
        <div className="p-8 rounded-[2.5rem] bg-card border shadow-sm flex flex-col justify-between gap-6 group hover:border-primary/40 transition-all ring-1 ring-border shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]">
            <div className="space-y-4">
                <div className="p-3 bg-primary/5 rounded-2xl w-fit shadow-xs text-primary border border-primary/10 group-hover:scale-105 transition-transform"><Icon className="h-6 w-6" /></div>
                <h4 className="text-lg font-bold tracking-tight text-foreground">{title}</h4>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
            </div>
            <div className="flex gap-4 pt-4 border-t">
                <Button onClick={onSync} disabled={status === 'seeding'} className="rounded-xl font-bold h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95">
                    {status === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />} Map Agreements
                </Button>
                {onRollback && (
                    <Button variant="outline" onClick={onRollback} className="rounded-xl font-bold border-rose-200 text-rose-600 hover:bg-rose-50 h-12 px-6 shadow-sm active:scale-95 transition-all">
                        <TriangleAlert className="h-5 w-5 mr-2" /> Rollback
                    </Button>
                )}
            </div>
        </div>
    );
}
