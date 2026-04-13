'use client';

import * as React from 'react';
import { DonutChart, type DonutChartSegment } from "@/components/ui/donut-chart";
import DashboardCard from "./DashboardCard";
import { cn } from '@/lib/utils';

export function PipelinePieChart({ 
    stages, 
    terminology = { singular: 'Entity', plural: 'Entities' } 
}: { 
    stages: { name: string; count: number; students: number; color?: string }[];
    terminology?: { singular: string; plural: string };
}) {
    const [hoveredSegment, setHoveredSegment] = React.useState<DonutChartSegment | null>(null);

    const chartData = React.useMemo(() => stages.map(stage => ({
        value: stage.count,
        label: stage.name,
        color: stage.color || '#cccccc',
        students: stage.students,
    })), [stages]);

    const totalCount = React.useMemo(() => stages.reduce((acc, curr) => acc + curr.count, 0), [stages]);
    const totalStudents = React.useMemo(() => stages.reduce((acc, curr) => acc + curr.students, 0), [stages]);

    const handleSegmentHover = (segment: DonutChartSegment | null) => {
        setHoveredSegment(segment);
    };

    const centerContent = (
        <div className="text-center">
            {hoveredSegment ? (
                <>
                    <p className="text-sm text-muted-foreground truncate px-2">{hoveredSegment.label}</p>
                    <p className="text-3xl font-bold">
                        {totalCount > 0 ? ((hoveredSegment.value / totalCount) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {hoveredSegment.value} {hoveredSegment.value === 1 ? terminology.singular : terminology.plural}
                    </p>
                    <p className="text-lg font-semibold mt-1">{hoveredSegment.students?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                </>
            ) : (
                <>
                    <p className="text-3xl font-bold">{totalCount}</p>
                    <p className="text-sm text-muted-foreground">Total {terminology.plural}</p>
                    <p className="text-xl font-semibold mt-2">{totalStudents.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                </>
            )}
        </div>
    );
    
    if (totalCount === 0) {
        return (
            <DashboardCard title="Onboarding Pipeline">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No {terminology.plural.toLowerCase()} in the pipeline yet.</p>
                </div>
            </DashboardCard>
        );
    }
  
    return (
        <DashboardCard title="Onboarding Pipeline">
            <div className="flex flex-col items-center justify-center">
                <DonutChart
                    data={chartData}
                    size={280}
                    strokeWidth={30}
                    centerContent={centerContent}
                    hoveredSegment={hoveredSegment}
                    onSegmentHover={handleSegmentHover}
                />
                <div className="w-full max-w-sm mt-6 space-y-2">
                    {chartData.map((segment, index) => {
                         if (segment.value === 0) return null;
                         const isActive = hoveredSegment?.label === segment.label;
                         const compositeKey = `${segment.label}-${index}`;
                         return (
                            <div 
                                key={compositeKey}
                                className={cn(
                                    "flex justify-between items-center p-2 rounded-md transition-colors cursor-pointer",
                                    isActive && "bg-muted"
                                )}
                                onMouseEnter={() => handleSegmentHover(segment)}
                                onMouseLeave={() => handleSegmentHover(null)}
                            >
                                <div className="flex items-center gap-2">
                                    <span 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: segment.color }}
                                    />
                                    <span className="text-sm font-medium">{segment.label}</span>
                                </div>
                                <span className="font-semibold text-sm">{segment.value}</span>
                            </div>
                         )
                    })}
                </div>
            </div>
        </DashboardCard>
    )
}
