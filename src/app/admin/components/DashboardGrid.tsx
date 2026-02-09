
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
    MonthlySchoolsChart
} from "@/components/dashboard";
import { DraggableCard } from './DraggableCard';
import type { DashboardLayout } from '@/lib/types';
import { DashboardSkeleton } from './DashboardSkeleton';


const componentMap: Record<string, React.FC<any>> = {
  quickActions: QuickActions,
  pipelinePieChart: PipelinePieChart,
  latestSurveys: LatestSurveys,
  recentActivity: RecentActivity,
  upcomingMeetings: UpcomingMeetings,
  userAssignments: UserAssignments,
  monthlySchoolsChart: MonthlySchoolsChart,
};

const componentPropsMap = (data: any) => ({
  quickActions: {},
  pipelinePieChart: { stages: data.pipelineCounts },
  latestSurveys: { surveys: data.latestSurveys },
  recentActivity: { schools: data.recentSchools },
  upcomingMeetings: { meetings: data.upcomingMeetings },
  userAssignments: { data: data.userAssignments, totalSchools: data.metrics.totalSchools },
  monthlySchoolsChart: { data: data.monthlySchools },
});

const componentGridConfig: Record<string, string> = {
  userAssignments: 'lg:col-span-4',
  pipelinePieChart: 'lg:col-span-2 lg:row-span-2',
  quickActions: 'lg:col-span-2',
  latestSurveys: 'lg:col-span-2',
  upcomingMeetings: 'lg:col-span-2',
  monthlySchoolsChart: 'lg:col-span-4',
  recentActivity: 'lg:col-span-4',
};

const DEFAULT_LAYOUT = [
    'userAssignments',
    'pipelinePieChart',
    'quickActions',
    'latestSurveys',
    'upcomingMeetings',
    'monthlySchoolsChart',
    'recentActivity',
];

export default function DashboardGrid({ initialData }: { initialData: any }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [orderedComponents, setOrderedComponents] = useState<string[]>(DEFAULT_LAYOUT);
    const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);

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
