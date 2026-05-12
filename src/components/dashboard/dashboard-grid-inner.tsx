'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { ResponsiveGridLayout as Responsive } from 'react-grid-layout';
import { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, ResponsiveLayouts as Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { DashboardLayoutConfig } from '@/lib/types/dashboard';
import { renderWidget } from './widget-registry';
import { WidgetWrapper } from './widget-wrapper';
import { saveDashboardLayout } from '@/lib/services/dashboard.service';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridInnerProps {
  workspaceId: string;
  entityType?: string;
  config: DashboardLayoutConfig;
}

export default function DashboardGridInner({ workspaceId, entityType, config }: DashboardGridInnerProps) {
  const [layouts, setLayouts] = useState<Layouts>(config.layouts);
  const [isPending, startTransition] = useTransition();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLayoutChange = (currentLayout: Layout, allLayouts: Layouts) => {
    // Only update state if something changed to avoid loop
    setLayouts(allLayouts);

    // Debounce the server action save (e.g. 1500ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveDashboardLayout(workspaceId, allLayouts, entityType);
        } catch (error) {
          console.error("Failed to save layout", error);
        }
      });
    }, 1500);
  };

  return (
    <div className="w-full h-full relative">
      {/* Optional: Add a small saving indicator when isPending is true */}
      {isPending && (
        <div className="absolute top-0 right-0 m-2 text-xs text-muted-foreground z-10">
          Saving layout...
        </div>
      )}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        onLayoutChange={handleLayoutChange}
        dragConfig={{ enabled: true, handle: ".drag-handle" }}
        resizeConfig={{ enabled: true }}
        margin={[16, 16]}
      >
        {config.widgets.map((widget) => {
          // If a widget has a specific string ID, the grid item requires a key matching its layout `i`
          return (
            <div key={widget.id} className="flex h-full flex-col">
              <WidgetWrapper title={widget.title}>
                {renderWidget(widget.widgetId, { ...widget.props, workspaceId })}
              </WidgetWrapper>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
