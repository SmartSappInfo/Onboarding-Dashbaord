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
import {
    QuickActions,
    LatestSurveys,
    RecentActivity,
    UpcomingMeetings,
    PipelinePieChart,
    UserAssignments,
    MonthlySchoolsChart,
    ModuleRadarChart,
} from "@/components/dashboard";
import { DraggableCard } from './DraggableCard';
import type { DashboardLayout } from '@/lib/types';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';


const componentMap: Record<string, React.FC<any>> = {
  quickActions: QuickActions,
  pipelinePieChart: PipelinePieChart,
  latestSurveys: LatestSurveys,
  recentActivity: RecentActivity,
  upcomingMeetings: UpcomingMeetings,
  userAssignments: UserAssignments,
  monthlySchoolsChart: MonthlySchoolsChart,
  moduleRadarChart: ModuleRadarChart,
};

const componentPropsMap = (data: any) => ({
  quickActions: {},
  pipelinePieChart: { stages: data.pipelineCounts },
  latestSurveys: { surveys: data.latestSurveys },
  recentActivity: { schools: data.recentSchools },
  upcomingMeetings: { meetings: data.upcomingMeetings },
  userAssignments: { data: data.userAssignments, totalSchools: data.metrics.totalSchools },
  monthlySchoolsChart: { data: data.monthlySchools },
  moduleRadarChart: { data: data.moduleImplementations },
});

const componentGridConfig: Record<string, string> = {
  userAssignments: 'md:col-span-2 lg:col-span-4',
  pipelinePieChart: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  quickActions: 'lg:col-span-2',
  moduleRadarChart: 'lg:col-span-2',
  upcomingMeetings: 'lg:col-span-2',
  latestSurveys: 'lg:col-span-2',
  recentActivity: 'lg:col-span-2',
  monthlySchoolsChart: 'md:col-span-4',
};

const DEFAULT_LAYOUT = [
    'userAssignments',
    'pipelinePieChart',
    'moduleRadarChart',
    'quickActions',
    'upcomingMeetings',
    'latestSurveys',
    'recentActivity',
    'monthlySchoolsChart',
];

export default function DashboardGrid({ initialData }: { initialData: any }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [orderedComponents, setOrderedComponents] = useState<string[]>(DEFAULT_LAYOUT);
    const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
    const isMobile = useIsMobile();

    const layoutDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'dashboardLayouts', user.uid);
    }, [user, firestore]);

    const { data: layoutData, isLoading: isLayoutLoading } = useDoc<DashboardLayout>(layoutDocRef);

    useEffect(() => {
        if (!isLayoutLoading) {
            if (layoutData?.componentIds) {
                // Filter out any IDs that are no longer valid components
                const validIds = layoutData.componentIds.filter(id => DEFAULT_LAYOUT.includes(id));
                // Add any new components that aren't in the saved layout
                const newIds = DEFAULT_LAYOUT.filter(id => !validIds.includes(id));
                setOrderedComponents([...validIds, ...newIds]);
            } else {
                setOrderedComponents(DEFAULT_LAYOUT);
            }
            setIsLayoutLoaded(true);
        }
    }, [layoutData, isLayoutLoading]);
    
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setOrderedComponents((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                
                // Persist to Firestore
                if (user && firestore) {
                    setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: newOrder });
                }
                
                return newOrder;
            });
        }
    };

    if (!isLayoutLoaded) {
        return <DashboardSkeleton />;
    }

    if (isMobile) {
        return (
            <div className="grid grid-cols-1 gap-6">
                {orderedComponents.map((id) => {
                    const Component = componentMap[id];
                    if (!Component) return null;

                    const props = componentPropsMap(initialData)[id];

                    return (
                        <div key={id}>
                            <Component {...props} />
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedComponents} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {orderedComponents.map((id) => {
                        const Component = componentMap[id];
                        if (!Component) return null;

                        const props = componentPropsMap(initialData)[id];
                        const gridClass = componentGridConfig[id] || 'lg:col-span-2';

                        return (
                            <DraggableCard key={id} id={id} className={gridClass}>
                                <Component {...props} />
                            </DraggableCard>
                        );
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
}
