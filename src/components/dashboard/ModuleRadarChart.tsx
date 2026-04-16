"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart } from "recharts";
import * as React from "react";
import DashboardCard from "./DashboardCard";

/**
 * @fileOverview Module Implementation Radar Chart.
 * Visualizes the functional footprint of entities within the active workspace.
 */
export function ModuleRadarChart({ 
  data,
  terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
  data: { abbreviation: string; name: string; count: number }[],
  terminology?: { singular: string; plural: string }
}) {
  const chartConfig = {
    count: {
      label: terminology.plural,
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  // Resilience: Check for data before attempting to sort
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [data]);

  if (!data || chartData.length < 3) {
      return (
        <DashboardCard title="Module usage" terminology={terminology}>
          <div className="h-[250px] flex items-center justify-center">
              <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest opacity-40 italic">
                {!data ? 'Awaiting metrics...' : 'Insufficent module data'}
              </p>
          </div>
        </DashboardCard>
      )
  }

  return (
    <DashboardCard title="Module usage" terminology={terminology}>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-h-[250px]"
      >
        <RechartsRadarChart data={chartData}>
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload
                return (
                  <div className="rounded-2xl border bg-background/80 backdrop-blur-xl p-3 shadow-2xl text-[10px] space-y-1">
                    <p className="font-black uppercase tracking-widest text-primary">{d.name}</p>
                    <p className="text-muted-foreground font-bold">{d.count} {d.count === 1 ? terminology.singular : terminology.plural} Active</p>
                  </div>
                )
              }
              return null;
            }}
          />
          <PolarAngleAxis dataKey="abbreviation" tick={{ fontSize: 10, fontWeight: 'bold' }} />
          <PolarGrid strokeDasharray="3 3" strokeOpacity={0.1} />
          <defs>
            <filter
              id="stroke-line-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <Radar
            dataKey="count"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.1}
            strokeWidth={3}
            filter="url(#stroke-line-glow)"
          />
        </RechartsRadarChart>
      </ChartContainer>
    </DashboardCard>
  );
}
