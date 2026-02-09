
'use client';

import * as React from 'react';
import { DonutChart, type DonutChartSegment } from "@/components/ui/donut-chart";
import DashboardCard from "./DashboardCard";

export function PipelinePieChart({ stages }: { stages: { name: string; count: number; students: number; color?: string }[] }) {
    const [hoveredSegment, setHoveredSegment] = React.useState<DonutChartSegment | null>(null);

    const chartData = stages.map(stage => ({
        value: stage.count,
        label: stage.name,
        color: stage.color || '#cccccc',
        students: stage.students,
    }));

    const totalSchools = React.useMemo(() => stages.reduce((acc, curr) => acc + curr.count, 0), [stages]);
    const totalStudents = React.useMemo(() => stages.reduce((acc, curr) => acc + curr.students, 0), [stages]);

    const handleSegmentHover = (segment: DonutChartSegment | null) => {
        setHoveredSegment(segment);
    };

    const centerContent = (
        <div className="text-center">
            {hoveredSegment ? (
                <>
                    <p className="text-sm text-muted-foreground truncate">{hoveredSegment.label}</p>
                    <p className="text-3xl font-bold">
                        {totalSchools > 0 ? ((hoveredSegment.value / totalSchools) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">{hoveredSegment.value} School{hoveredSegment.value === 1 ? '' : 's'}</p>
                    <p className="text-lg font-semibold mt-1">{hoveredSegment.students?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                </>
            ) : (
                <>
                    <p className="text-3xl font-bold">{totalSchools}</p>
                    <p className="text-sm text-muted-foreground">Total Schools</p>
                    <p className="text-xl font-semibold mt-2">{totalStudents.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                </>
            )}
        </div>
    );
    
    if (totalSchools === 0) {
        return (
            <DashboardCard title="Onboarding Pipeline">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No schools in the pipeline yet.</p>
                </div>
            </DashboardCard>
        );
    }
  
  return (
    <DashboardCard title="Onboarding Pipeline">
        <div className="w-full h-80 flex items-center justify-center">
            <DonutChart
                data={chartData}
                size={280}
                strokeWidth={30}
                centerContent={centerContent}
                onSegmentHover={handleSegmentHover}
            />
        </div>
    </DashboardCard>
  )
}
