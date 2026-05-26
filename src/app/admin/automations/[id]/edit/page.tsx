
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Automation } from '@/lib/types';
import { Loader2, ArrowLeft, Save, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { saveAutomationAction, testAutomationFlowAction } from '@/lib/automation-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AutomationBuilder = dynamic(() => import('../../components/AutomationBuilder'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
    </div>
  ),
});

/**
 * @fileOverview High-fidelity Automation Blueprint Editor.
 */
export default function EditAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();
  const automationId = params.id as string;

  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testDialogOpen, setTestDialogOpen] = React.useState(false);
  const [testEntityId, setTestEntityId] = React.useState('');
  const [currentData, setCurrentData] = React.useState<Partial<Automation>>({});

  const docRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'automations', automationId) : null),
    [firestore, automationId]
  );

  const { data: automation, isLoading } = useDoc<Automation>(docRef);

  const testWorkspaceId =
    automation?.workspaceIds?.[0] || activeWorkspaceId || '';

  const handleStateChange = React.useCallback((nodes: unknown[], edges: unknown[]) => {
    setCurrentData((prev) => {
      if (
        JSON.stringify(prev.nodes) === JSON.stringify(nodes) &&
        JSON.stringify(prev.edges) === JSON.stringify(edges)
      ) {
        return prev;
      }
      return { ...prev, nodes, edges } as Partial<Automation>;
    });
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const res = await saveAutomationAction(automationId, currentData, user.uid);
    if (res.success) {
      toast({ title: 'Logic Synchronized', description: 'Automation blueprint updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
    }
    setIsSaving(false);
  };

  const handleTestFlow = async () => {
    if (!user?.uid) return;
    if (!testEntityId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Entity required',
        description: 'Enter an entity ID to run the test against.',
      });
      return;
    }
    setIsTesting(true);
    const res = await testAutomationFlowAction(automationId, user.uid, {
      workspaceId: testWorkspaceId,
      entityId: testEntityId.trim(),
    });
    setIsTesting(false);
    if (res.success) {
      setTestDialogOpen(false);
      toast({
        title: 'Test run started',
        description: res.message || 'Check the Automation Hub run ledger.',
      });
    } else {
      toast({ variant: 'destructive', title: 'Test failed', description: res.error });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="p-20 text-center">
        <p className="text-muted-foreground font-semibold">Blueprint not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="h-16 shrink-0 bg-card/80 border-b px-6 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/automations')}
            className="rounded-xl h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 text-left">
            <h1 className="text-sm font-semibold tracking-tight truncate pr-4">
              {automation.name}
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground leading-none mt-0.5">
              Editing Workflow Blueprint
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-xl font-bold h-10 gap-2 border-primary/20 text-primary"
            onClick={() => setTestDialogOpen(true)}
          >
            <Play className="h-4 w-4" /> Test Flow
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl font-semibold h-10 px-8 shadow-xl shadow-primary/20 gap-2 text-[10px]"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Commit Logic
          </Button>
        </div>
      </header>

      {(!automation.workspaceIds || automation.workspaceIds.length === 0) && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 z-20">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-900">
            <span className="font-semibold">Warning:</span> This automation has no workspace
            constraint and may trigger across all workspaces.
          </p>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <AutomationBuilder
          initialNodes={automation.nodes}
          initialEdges={automation.edges}
          onStateChange={handleStateChange}
        />
      </div>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Test automation flow</DialogTitle>
            <DialogDescription>
              Runs this blueprint once with a synthetic trigger payload. Results appear in the
              Automation Hub run ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Workspace</Label>
              <Input value={testWorkspaceId} disabled className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Entity ID</Label>
              <Input
                value={testEntityId}
                onChange={(e) => setTestEntityId(e.target.value)}
                placeholder="Entity to target for this test"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestFlow} disabled={isTesting} className="gap-2">
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
