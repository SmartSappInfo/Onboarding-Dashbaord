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
    LatestSurveys,
    UpcomingMeetings,
    PipelinePieChart,
    UserAssignments,
    MonthlySchoolsChart,
    ModuleRadarChart,
    RecentActivity,
    ZoneDistribution,
    MessagingWidget,
    TaskWidget,
} from "@/components/dashboard";
import { DraggableCard } from './DraggableCard';
import type { DashboardLayout } from '@/lib/types';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';


const componentMap: Record<string, React.FC<any>> = {
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

const componentPropsMap = (data: any) => ({
  taskWidget: {},
  pipelinePieChart: { stages: data.pipelineCounts },
  latestSurveys: { surveys: data.latestSurveys },
  upcomingMeetings: { meetings: data.upcomingMeetings },
  userAssignments: { data: data.userAssignments, totalSchools: data.metrics.totalSchools, totalStudents: data.metrics.totalStudents },
  monthlySchoolsChart: { data: data.monthlySchools },
  moduleRadarChart: { data: data.moduleImplementations },
  recentActivity: {
    activities: data.activities,
    users: data.recentActivityUsers,
    schools: data.recentActivitySchools,
  },
  zoneDistribution: { data: data.zoneDistribution },
  messagingWidget: { ...data.messagingMetrics },
});

const componentGridConfig: Record<string, string> = {
  userAssignments: 'md:col-span-2 lg:col-span-4',
  taskWidget: 'md:col-span-2 lg:col-span-2',
  messagingWidget: 'md:col-span-2 lg:col-span-2',
  pipelinePieChart: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  upcomingMeetings: 'lg:col-span-2',
  moduleRadarChart: 'lg:col-span-2',
  latestSurveys: 'lg:col-span-2',
  monthlySchoolsChart: 'md:col-span-4',
  recentActivity: 'md:col-span-4 lg:col-span-2 lg:row-span-2',
  zoneDistribution: 'lg:col-span-2',
};

const DEFAULT_LAYOUT = [
    'userAssignments',
    'taskWidget',
    'messagingWidget',
    'pipelinePieChart',
    'upcomingMeetings',
    'recentActivity',
    'zoneDistribution',
    'moduleRadarChart',
    'latestSurveys',
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
                const validIds = layoutData.componentIds.filter((id: string) => DEFAULT_LAYOUT.includes(id));
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

                    const props = (componentPropsMap(initialData) as Record<string, any>)[id];

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

                        const props = (componentPropsMap(initialData) as Record<string, any>)[id];
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
