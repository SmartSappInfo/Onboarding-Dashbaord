'use client';

import * as React from "react";
import { DashboardHeader } from "./DashboardHeader";
import DashboardGrid from "./DashboardGrid";
import type { Workspace, Pipeline } from "@/lib/types";
import { useTenant } from "@/context/TenantContext";

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
    const [isCustomizerOpen, setIsCustomizerOpen] = React.useState(false);
    const canManageDashboard = hasPermission('dashboard_manage');

    return (
        <div className="space-y-10">
            <DashboardHeader 
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspace={activeWorkspace}
                canManageDashboard={canManageDashboard}
                terminology={terminology}
                onOpenCustomizer={() => setIsCustomizerOpen(true)}
            />

            <DashboardGrid 
                widgets={widgets}
                pipelines={pipelines}
                isCustomizerOpen={isCustomizerOpen}
                onCustomizerChange={setIsCustomizerOpen}
            />
        </div>
    );
}
