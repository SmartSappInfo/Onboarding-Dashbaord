'use client';

import * as React from "react";
import { DashboardHeader } from "./DashboardHeader";
import DashboardGrid from "./DashboardGrid";
import type { Workspace, Pipeline } from "@/lib/types";
import { useTenant } from "@/context/TenantContext";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { createTaskAction } from "@/lib/task-server-actions";
import TaskEditor from "@/app/admin/tasks/components/TaskEditor";

interface DashboardClientWrapperProps {
    activeWorkspaceId: string;
    activeWorkspace: Workspace;
    terminology: { singular: string; plural: string };
    pipelines: Pipeline[];
    widgets: Record<string, React.ReactNode>;
    canManageDashboard: boolean;
}

export function DashboardClientWrapper({
    activeWorkspaceId,
    activeWorkspace,
    terminology,
    pipelines,
    widgets,
}: Omit<DashboardClientWrapperProps, 'canManageDashboard'>) {
    const { hasPermission } = useTenant();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    const [isCustomizerOpen, setIsCustomizerOpen] = React.useState(false);
    const [isTaskEditorOpen, setIsTaskEditorOpen] = React.useState(false);
    const [isSavingTask, setIsSavingTask] = React.useState(false);
    const canManageDashboard = hasPermission('dashboard_manage');

    const handleSaveTask = async (payload: any) => {
        if (!currentUser) return;
        setIsSavingTask(true);
        try {
            const finalPayload = { ...payload, workspaceId: activeWorkspaceId };
            const res = await createTaskAction(finalPayload, currentUser.uid);

            if (res.success) {
                toast({ title: 'Task Initialized' });
                setIsTaskEditorOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Operation Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || "Failed to save task." });
        } finally {
            setIsSavingTask(false);
        }
    };

    return (
        <div className="space-y-10">
            <DashboardHeader 
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspace={activeWorkspace}
                canManageDashboard={canManageDashboard}
                terminology={terminology}
                onOpenCustomizer={() => setIsCustomizerOpen(true)}
                onOpenTaskEditor={() => setIsTaskEditorOpen(true)}
            />

            <DashboardGrid 
                widgets={widgets}
                pipelines={pipelines}
                isCustomizerOpen={isCustomizerOpen}
                onCustomizerChange={setIsCustomizerOpen}
            />

            <TaskEditor
                open={isTaskEditorOpen}
                onOpenChange={setIsTaskEditorOpen}
                onSave={handleSaveTask}
                isSaving={isSavingTask}
            />
        </div>
    );
}
