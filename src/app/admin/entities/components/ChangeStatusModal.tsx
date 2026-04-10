'use client';

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { School, WorkspaceStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    CheckCircle2, 
    Zap, 
    UserMinus, 
    Loader2, 
    ShieldCheck,
    AlertCircle,
    Info,
    Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activity-logger';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';

interface ChangeStatusModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangeStatusModal({ school, open, onOpenChange }: ChangeStatusModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Statuses are now dynamic and independent per workspace
  const workspaceStatuses = React.useMemo(() => {
      if (activeWorkspace?.statuses && activeWorkspace.statuses.length > 0) {
          return activeWorkspace.statuses;
      }
      // Fallback to standard Onboarding statuses
      return [
          { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF', description: 'Initialization phase.' },
          { value: 'Active', label: 'Active', color: '#10b981', description: 'Institutional go-live.' },
          { value: 'Churned', label: 'Churned', color: '#ef4444', description: 'No longer operational.' }
      ];
  }, [activeWorkspace]);

  const handleStatusChange = async (newStatus: string) => {
    if (!firestore || !school || !user || isUpdating) return;
    if (school.schoolStatus === newStatus) {
        onOpenChange(false);
        return;
    }

    setIsUpdating(true);
    const schoolRef = doc(firestore, 'schools', school.id);

    try {
      await updateDoc(schoolRef, {
        schoolStatus: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      toast({ 
        title: 'Status Updated', 
        description: `"${school.name}" state set to ${newStatus}.` 
      });

      logActivity({
          entityId: school.id,
          userId: user.uid,
          organizationId: activeOrganizationId,
          workspaceId: school.workspaceIds[0] || 'onboarding',
          type: 'school_updated',
          source: 'user_action',
          description: `changed status of "${school.name}" from ${school.schoolStatus} to ${newStatus}`,
          metadata: { from: school.schoolStatus, to: newStatus }
      });

      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!school) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">School Status Architect</DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Modify current status for {school.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 bg-background">
            {workspaceStatuses.map((status) => {
                const isActive = school.schoolStatus === status.value;

                return (
                    <button
                        key={status.value}
                        onClick={() => handleStatusChange(status.value)}
                        disabled={isUpdating}
                        className={cn(
                            "w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left group",
                            isActive ? "border-primary bg-primary/5 shadow-md" : "border-transparent bg-muted/20 hover:bg-muted/40",
                            isUpdating && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div 
                            className={cn(
                                "p-2 rounded-xl shrink-0 transition-transform group-hover:scale-110 shadow-sm",
                                isActive ? "bg-primary text-white" : "bg-white border"
                            )}
                            style={!isActive ? { color: status.color, borderColor: `${status.color}40` } : {}}
                        >
                            {status.value === 'Active' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <p className="font-black uppercase text-sm tracking-tight">{status.label}</p>
                                {isActive && <CheckCircle2 className="h-4 w-4 text-primary animate-in zoom-in" />}
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground mt-0.5 leading-relaxed">
                                {status.description || 'Lifecycle phase entry.'}
                            </p>
                        </div>
                    </button>
                );
            })}

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 mt-4">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter text-left">
                    "School Status" is unique to the **{activeWorkspace?.name}** hub. Changes are reflected in the pipeline and reporting views.
                </p>
            </div>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t shrink-0 flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUpdating} className="rounded-xl font-bold">Discard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
