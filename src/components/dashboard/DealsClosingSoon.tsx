import React from 'react';
import { Card } from '@/components/ui/card';

// We would fetch this via a server action in reality.
export function DealsClosingSoon({ workspaceId }: { workspaceId: string }) {
  // Mock data for deals closing soon
  const mockDeals = [
    { id: '1', name: 'Acme Corp Enterprise', amount: '$15,000', daysLeft: 2, owner: 'Sarah J.' },
    { id: '2', name: 'Global Tech Renewal', amount: '$8,500', daysLeft: 5, owner: 'Mike T.' },
    { id: '3', name: 'Stark Industries', amount: '$42,000', daysLeft: 12, owner: 'Sarah J.' },
  ];

  return (
    <div className="flex flex-col space-y-3 p-2">
      {mockDeals.map(deal => (
        <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{deal.name}</span>
            <span className="text-xs text-muted-foreground">Owner: {deal.owner}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{deal.amount}</span>
            <span className={`text-xs font-medium ${deal.daysLeft <= 3 ? 'text-red-500' : 'text-amber-500'}`}>
              in {deal.daysLeft} days
            </span>
          </div>
        </div>
      ))}
      {mockDeals.length === 0 && (
        <div className="text-center p-4 text-sm text-muted-foreground">
          No deals closing soon.
        </div>
      )}
    </div>
  );
}
