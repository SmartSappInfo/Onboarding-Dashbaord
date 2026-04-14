'use client';
import React, { useState, useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { doc, setDoc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { LatestSurveys } from "@/components/dashboard/LatestSurveys";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { PipelinePieChart } from "@/components/dashboard/PipelinePieChart";
import { UserAssignments } from "@/components/dashboard/UserAssignments";
import { MonthlySchoolsChart } from "@/components/dashboard/MonthlySchoolsChart";
import { ModuleRadarChart } from "@/components/dashboard/ModuleRadarChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ZoneDistribution } from "@/components/dashboard/ZoneDistribution";
import { MessagingWidget } from "@/components/dashboard/MessagingWidget";
import { TaskWidget } from "@/components/dashboard/TaskWidget";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { DraggableCard } from './DraggableCard';
import type { DashboardLayout, Pipeline } from '@/lib/types';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFeatures } from '@/hooks/use-features';
import { useTenant } from '@/context/TenantContext';
import { STATIC_WIDGETS, filterWidgetsByFeatures, DEFAULT_WIDGET_IDS, getAllWidgets } from '@/lib/widget-registry';
import WidgetSelector from './WidgetSelector';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Plus } from 'lucide-react';


const staticComponentMap: Record<string, React.FC<any>> = {
  taskWidget: TaskWidget,
  pipelinePieChart: PipelinePieChart,
  latestSurveys: LatestSurveys,
  upcomingMeetings: UpcomingMeetings,
  userAssignments: UserAssignments,
  monthlySchoolsChart: MonthlySchoolsChart,
  moduleRadarChart: ModuleRadarChart,
  recentActivity: RecentActivity,
  zoneDistribution: ZoneDistribution,
  messagingWidget: MessagingWidget,
};

export default function DashboardGrid({ 
    widgets,
    pipelines = [], 
    isCustomizerOpen, 
    onCustomizerChange 
}: { 
    widgets: Record<string, React.ReactNode>;
    pipelines?: Pipeline[];
    isCustomizerOpen: boolean;
    onCustomizerChange: (open: boolean) => void;
}) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { activeWorkspaceId, activeWorkspace, hasPermission } = useTenant();
    const { isFeatureEnabled } = useFeatures();
    const canManageDashboard = hasPermission('dashboard_manage');

    const [orderedComponents, setOrderedComponents] = useState<string[]>(DEFAULT_WIDGET_IDS);
    const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
    const isMobile = useIsMobile();
    const isInitialLoadDoneRef = React.useRef(false);

    // Reset load state when workspace changes
    useEffect(() => {
        isInitialLoadDoneRef.current = false;
        setIsLayoutLoaded(false);
    }, [activeWorkspaceId]);

    // Workspace-specific shared layout
    const layoutDocId = activeWorkspaceId ? `workspace_${activeWorkspaceId}` : null;

    const layoutDocRef = useMemoFirebase(() => {
        if (!layoutDocId || !firestore) return null;
        return doc(firestore, 'dashboardLayouts', layoutDocId);
    }, [layoutDocId, firestore]);

    const { data: layoutData, isLoading: isLayoutLoading } = useDoc<DashboardLayout>(layoutDocRef);

    // Build the full set of valid widget IDs (static + pipeline)
    const allWidgetDefinitions = React.useMemo(() => {
        return getAllWidgets(pipelines.map(p => ({ id: p.id, name: p.name })));
    }, [pipelines]);

    // Filter by enabled features
    const featureFilteredWidgets = React.useMemo(() => {
        return filterWidgetsByFeatures(allWidgetDefinitions, isFeatureEnabled);
    }, [allWidgetDefinitions, isFeatureEnabled]);

    const validWidgetIds = React.useMemo(() => {
        return new Set(featureFilteredWidgets.map(w => w.id));
    }, [featureFilteredWidgets]);

    // Grid class lookup from widget definitions
    const gridClassMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        allWidgetDefinitions.forEach(w => { map[w.id] = w.gridClass; });
        return map;
    }, [allWidgetDefinitions]);

    useEffect(() => {
        if (!isLayoutLoading && !isInitialLoadDoneRef.current) {
            let nextOrder: string[] = [];
            if (layoutData?.componentIds) {
                // Keep only valid (feature-enabled) IDs, preserve order
                const validIds = layoutData.componentIds.filter((id: string) => validWidgetIds.has(id));
                // Add any new default widget IDs not already in the layout
                const existingSet = new Set(validIds);
                const newDefaults = DEFAULT_WIDGET_IDS.filter(id => !existingSet.has(id) && validWidgetIds.has(id));
                nextOrder = [...validIds, ...newDefaults];
            } else {
                // Fresh workspace: start with defaults that are feature-enabled
                nextOrder = DEFAULT_WIDGET_IDS.filter(id => validWidgetIds.has(id));
            }

            setOrderedComponents(nextOrder);
            setIsLayoutLoaded(true);
            isInitialLoadDoneRef.current = true;
        }
    }, [layoutData, isLayoutLoading, validWidgetIds]);
    
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }));

    const persistLayout = React.useCallback((newOrder: string[]) => {
        if (layoutDocId && firestore && isInitialLoadDoneRef.current) {
            setDoc(doc(firestore, 'dashboardLayouts', layoutDocId), { componentIds: newOrder });
        }
    }, [layoutDocId, firestore]);

    // Persist layout changes to Firestore
    useEffect(() => {
        if (isLayoutLoaded && isInitialLoadDoneRef.current) {
            persistLayout(orderedComponents);
        }
    }, [orderedComponents, isLayoutLoaded, persistLayout]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setOrderedComponents((prev) => {
                const oldIndex = prev.indexOf(active.id as string);
                const newIndex = prev.indexOf(over.id as string);
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    };

    const handleToggleWidget = (widgetId: string, action: 'add' | 'remove') => {
        setOrderedComponents((prev) => {
            if (action === 'add') {
                if (prev.includes(widgetId)) return prev;
                return [...prev, widgetId];
            } else {
                return prev.filter(id => id !== widgetId);
            }
        });
    };

    if (!isLayoutLoaded) {
        return <DashboardSkeleton />;
    }

    // Only render widgets that are currently feature-enabled
    const visibleComponents = orderedComponents.filter(id => validWidgetIds.has(id));

    if (isMobile) {
        return (
            <>
                <div className="grid grid-cols-1 gap-6">
                    {visibleComponents.map((id) => {
                        const widget = widgets[id];
                        if (!widget) return null;
                        return (
                            <div key={id}>
                                {widget}
                            </div>
                        );
                    })}
                </div>
                <WidgetSelector
                    open={isCustomizerOpen}
                    onOpenChange={onCustomizerChange}
                    activeWidgetIds={visibleComponents}
                    pipelines={pipelines}
                    onToggleWidget={handleToggleWidget}
                />
            </>
        );
    }

    return (
        <div className="relative">
            {/* Dynamic Atmosphere Gradient */}
            <div 
                className="fixed inset-0 pointer-events-none opacity-[0.03] transition-colors duration-1000"
                style={{ 
                    background: `radial-gradient(circle at 50% 50%, ${activeWorkspace?.color || '#3B5FFF'} 0%, transparent 70%)` 
                }}
            />

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleComponents} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                        {visibleComponents.map((id) => {
                            const widget = widgets[id];
                            if (!widget) return null;
                            const gridClass = gridClassMap[id] || 'lg:col-span-2';

                            return (
                                <DraggableCard key={id} id={id} className={gridClass} disabled={!canManageDashboard}>
                                    {widget}
                                </DraggableCard>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>
            <WidgetSelector
                open={isCustomizerOpen}
                onOpenChange={onCustomizerChange}
                activeWidgetIds={orderedComponents}
                pipelines={pipelines}
                onToggleWidget={handleToggleWidget}
            />
        </div>
    );
}
