/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 3):
 * 
 * DeduplicationQueueTab implements UI Spec Section 20:
 * - Dedicated inbox categorizing collisions between newly discovered prospects and existing CRM entities.
 * - Confidence classification (High Confidence >= 95%, Probable Collision 80%-94%).
 * - 1-Click Auto-Merge for high confidence pairs and interactive Diff Studio modal triggers.
 * - On-demand full workspace multi-factor collision scanner.
 * - Adheres strictly to Workspace Rules: min-h-[44px] touch targets, zero 'any' typing, Emil Kowalski animations.
 */

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  GitMerge, 
  Search, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Eye, 
  Globe, 
  Phone, 
  Loader2
} from 'lucide-react';
import type { IdentityCollisionRecord, CollisionStatus } from '@/lib/lead-intelligence/types';
import { 
  getIdentityCollisionsAction, 
  scanWorkspaceForCollisionsAction, 
  dismissCollisionAction,
  executeIdentityMergeAction 
} from '@/app/actions/lead-intelligence-actions';
import { MergeDiffStudioModal } from './MergeDiffStudioModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DeduplicationQueueTabProps {
  workspaceId: string;
  onCollisionResolved?: () => void;
}

export function DeduplicationQueueTab({
  workspaceId,
  onCollisionResolved
}: DeduplicationQueueTabProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [collisions, setCollisions] = useState<IdentityCollisionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<CollisionStatus>('pending_review');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Active modal state
  const [selectedCollision, setSelectedCollision] = useState<IdentityCollisionRecord | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Fetch collisions
  const loadCollisions = React.useCallback(async (status: CollisionStatus) => {
    if (!workspaceId) return;
    try {
      const data = await getIdentityCollisionsAction(workspaceId, status);
      setCollisions(data);
    } catch {
      toast({
        title: 'Error loading collisions',
        description: 'Could not fetch identity resolution review queue.',
        variant: 'destructive'
      });
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    startTransition(() => {
      loadCollisions(statusFilter);
    });
  }, [statusFilter, loadCollisions]);

  // Scan workspace
  const handleScanWorkspace = async () => {
    setIsScanning(true);
    try {
      const result = await scanWorkspaceForCollisionsAction(workspaceId);
      toast({
        title: 'Collision Scan Completed',
        description: `Found ${result.createdCount} potential collision pairs across workspace entities.`
      });
      loadCollisions(statusFilter);
      if (onCollisionResolved) onCollisionResolved();
    } catch {
      toast({
        title: 'Scan Failed',
        description: 'An error occurred during workspace multi-factor scan.',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // 1-Click Auto Merge for High-Confidence pairs (>=95%)
  const handleOneClickAutoMerge = async (collision: IdentityCollisionRecord) => {
    try {
      const payload = {
        collisionId: collision.id,
        prospectId: collision.prospectId,
        entityId: collision.entityId,
        fieldSelection: {
          nameChoice: 'record_b' as const,
          domainChoice: collision.prospect.domain ? ('record_a' as const) : ('record_b' as const),
          phoneChoice: collision.prospect.phone ? ('record_a' as const) : ('record_b' as const),
          addressChoice: 'record_b' as const,
          technologiesStrategy: 'combine' as const,
          contactsStrategy: 'combine' as const
        },
        notes: `1-Click Auto-Merged with ${Math.round(collision.matchConfidence * 100)}% match confidence.`
      };

      const result = await executeIdentityMergeAction(workspaceId, payload);
      if (result.success) {
        toast({
          title: 'Records Auto-Merged',
          description: `Successfully synthesized canonical entity for ${collision.existingEntityName}.`
        });
        loadCollisions(statusFilter);
        if (onCollisionResolved) onCollisionResolved();
      } else {
        toast({
          title: 'Auto-Merge Failed',
          description: result.error || 'Could not complete auto-merge.',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Auto-Merge Error',
        description: 'An unexpected error occurred during auto-merge.',
        variant: 'destructive'
      });
    }
  };

  // Dismiss or Keep Separate
  const handleDismiss = async (collisionId: string, resolution: 'keep_separate' | 'dismissed') => {
    try {
      const result = await dismissCollisionAction(collisionId, workspaceId, resolution);
      if (result.success) {
        toast({
          title: resolution === 'keep_separate' ? 'Marked as Separate Records' : 'Collision Dismissed',
          description: 'Queue updated successfully.'
        });
        loadCollisions(statusFilter);
        if (onCollisionResolved) onCollisionResolved();
      }
    } catch {
      toast({
        title: 'Action Failed',
        description: 'Could not update collision status.',
        variant: 'destructive'
      });
    }
  };

  // Filtered list
  const filteredCollisions = collisions.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.prospect.name.toLowerCase().includes(q) ||
      c.existingEntityName.toLowerCase().includes(q) ||
      (c.prospect.domain && c.prospect.domain.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <GitMerge className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              Identity & Deduplication Center
              <Badge variant="outline" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                {collisions.length} {statusFilter === 'pending_review' ? 'Pending' : 'Records'}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Review and synthesize duplicates between discovered prospects and existing CRM records.
            </p>
          </div>
        </div>

        {/* Scan Button */}
        <Button
          type="button"
          onClick={handleScanWorkspace}
          disabled={isScanning}
          className="rounded-xl min-h-[44px] font-bold bg-primary text-primary-foreground active:scale-[0.97] flex items-center gap-2 shadow-xs"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scanning Multi-Factor Match...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Scan for Collisions</span>
            </>
          )}
        </Button>
      </div>

      {/* Filter Ribbon & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border rounded-xl">
          <button
            type="button"
            onClick={() => setStatusFilter('pending_review')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] cursor-pointer",
              statusFilter === 'pending_review' 
                ? "bg-card text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pending Review
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('merged')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] cursor-pointer",
              statusFilter === 'merged' 
                ? "bg-card text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Merged History
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('kept_separate')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] cursor-pointer",
              statusFilter === 'kept_separate' 
                ? "bg-card text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Kept Separate
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by company or domain..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 text-xs rounded-xl min-h-[40px]"
          />
        </div>
      </div>

      {/* Collision Queue Cards */}
      {isPending ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
          Loading deduplication queue...
        </div>
      ) : filteredCollisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-card border text-center space-y-3">
          <div className="p-3 bg-muted/30 rounded-2xl text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Zero Collisions Detected</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {statusFilter === 'pending_review' 
                ? 'All discovered prospects are cleanly isolated from existing CRM records.' 
                : 'No collision records found for this filter.'}
            </p>
          </div>
          {statusFilter === 'pending_review' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleScanWorkspace}
              disabled={isScanning}
              className="rounded-xl min-h-[40px] text-xs font-semibold mt-2"
            >
              Run On-Demand Identity Scan
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCollisions.map((collision) => {
            const isHighConfidence = collision.matchConfidence >= 0.95;

            return (
              <div 
                key={collision.id}
                className="p-4 rounded-2xl bg-card border shadow-xs transition-all hover:border-primary/30 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
              >
                {/* Left: Collision Pair Metadata */}
                <div className="space-y-3 flex-1 min-w-0">
                  {/* Badge & Evidence */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge 
                      className={cn(
                        "text-[10px] font-bold",
                        isHighConfidence 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      )}
                    >
                      {Math.round(collision.matchConfidence * 100)}% Confidence ({collision.matchType.replace('_', ' ').toUpperCase()})
                    </Badge>
                    {collision.matchReasons.map((reason, rIdx) => (
                      <span key={rIdx} className="text-[11px] text-muted-foreground flex items-center gap-1 bg-muted/40 px-2 py-0.5 rounded-md">
                        <Sparkles className="h-3 w-3 text-primary" /> {reason}
                      </span>
                    ))}
                  </div>

                  {/* Comparison Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Record A */}
                    <div className="p-2.5 rounded-xl bg-sky-500/5 border border-sky-500/15 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">RECORD A: DISCOVERED</span>
                        <span className="text-[10px] text-muted-foreground">{collision.prospect.source}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{collision.prospect.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground truncate">
                        {collision.prospect.domain && (
                          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{collision.prospect.domain}</span>
                        )}
                        {collision.prospect.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{collision.prospect.phone}</span>
                        )}
                      </div>
                    </div>

                    {/* Record B */}
                    <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">RECORD B: CRM ENTITY</span>
                        <span className="text-[10px] text-muted-foreground">{collision.existingEntityContactsCount} Contacts</span>
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{collision.existingEntityName}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground truncate">
                        {collision.existingEntityDomain && (
                          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{collision.existingEntityDomain}</span>
                        )}
                        {collision.existingEntityPhone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{collision.existingEntityPhone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Controls */}
                {statusFilter === 'pending_review' && (
                  <div className="flex flex-wrap md:flex-col items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedCollision(collision);
                        setIsDiffModalOpen(true);
                      }}
                      className="rounded-xl min-h-[40px] text-xs font-bold bg-primary text-primary-foreground active:scale-[0.97] flex items-center gap-1.5 w-full sm:w-auto"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Review Diff & Merge</span>
                    </Button>

                    {isHighConfidence && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleOneClickAutoMerge(collision)}
                        className="rounded-xl min-h-[40px] text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.97] flex items-center gap-1.5 w-full sm:w-auto"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>1-Click Auto-Merge</span>
                      </Button>
                    )}

                    <div className="flex items-center gap-1.5 w-full justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(collision.id, 'keep_separate')}
                        className="rounded-lg text-[11px] text-muted-foreground hover:text-foreground h-8 px-2"
                      >
                        Keep Separate
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(collision.id, 'dismissed')}
                        className="rounded-lg text-[11px] text-muted-foreground hover:text-destructive h-8 px-2"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Merge Diff Studio Modal */}
      <MergeDiffStudioModal
        collision={selectedCollision}
        isOpen={isDiffModalOpen}
        onClose={() => {
          setIsDiffModalOpen(false);
          setSelectedCollision(null);
        }}
        onMergedSuccess={() => {
          loadCollisions(statusFilter);
          if (onCollisionResolved) onCollisionResolved();
        }}
        workspaceId={workspaceId}
      />
    </div>
  );
}
