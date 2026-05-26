import React from 'react';

export function CampaignDeliveryRate({ workspaceId }: { workspaceId: string }) {
  // Mock data for delivery rate
  const deliveryRate = 98.4;
  const bounceRate = 1.6;

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 p-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Simple CSS Donut representation */}
        <div 
          className="w-full h-full rounded-full"
          style={{
            background: `conic-gradient(#10b981 ${deliveryRate}%, #ef4444 ${deliveryRate}% 100%)`
          }}
        ></div>
        <div className="absolute w-24 h-24 bg-card rounded-full flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{deliveryRate}%</span>
          <span className="text-[10px] text-muted-foreground font-medium">Delivered</span>
        </div>
      </div>
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span>Success</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Bounced</span>
        </div>
      </div>
    </div>
  );
}
