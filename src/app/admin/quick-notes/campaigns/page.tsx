'use client';

import * as React from 'react';
import { Rocket } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CampaignIntelligenceHubView } from '../components/campaigns/CampaignIntelligenceHubView';

export default function CampaignIntelligencePage() {
  const { activeWorkspaceId } = useWorkspace();

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-3">
        <Rocket className="h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm font-semibold text-muted-foreground">
          Select a workspace to open Campaign & Deal Intelligence...
        </p>
      </div>
    );
  }

  return <CampaignIntelligenceHubView />;
}
