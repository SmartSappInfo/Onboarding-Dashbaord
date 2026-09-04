import { ExecutiveIntelligenceWidget } from '@/components/dashboard/ExecutiveIntelligenceWidget';
import { AutonomousObservationEngine } from '@/lib/intelligence/services/autonomous-observation-engine';

export async function ExecutiveIntelligenceWidgetServer({ workspaceId }: { workspaceId: string }) {
  let summary = undefined;
  let recommendations = undefined;

  try {
    const scanResult = await AutonomousObservationEngine.runObservationScan(workspaceId);
    summary = scanResult.summary;
    recommendations = scanResult.recommendations;
  } catch {
    // Fall back to client-side loading if server-side evaluation fails
  }

  return (
    <div className="md:col-span-4 lg:col-span-4">
      <ExecutiveIntelligenceWidget
        workspaceId={workspaceId}
        initialSummary={summary}
        initialRecommendations={recommendations}
      />
    </div>
  );
}
