import React from 'react';
import { getPipelineData } from '@/app/actions/dashboard-actions';

export async function PipelineFunnel({ workspaceId }: { workspaceId: string }) {
  const data = await getPipelineData(workspaceId);
  
  // Fake data for visual representation until we connect to real deals pipeline
  const mockData = [
    { name: 'Lead', count: 120, color: '#3b82f6' },
    { name: 'Qualified', count: 80, color: '#8b5cf6' },
    { name: 'Proposal', count: 45, color: '#ec4899' },
    { name: 'Negotiation', count: 20, color: '#f59e0b' },
    { name: 'Closed Won', count: 12, color: '#10b981' }
  ];

  const maxCount = Math.max(...mockData.map(d => d.count));

  return (
    <div className="flex flex-col space-y-4 w-full px-2 py-4">
      {mockData.map((stage, i) => {
        const widthPercent = (stage.count / maxCount) * 100;
        return (
          <div key={i} className="flex flex-col space-y-1">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{stage.name}</span>
              <span>{stage.count}</span>
            </div>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500" 
                style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
