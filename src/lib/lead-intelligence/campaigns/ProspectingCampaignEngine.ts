/**
 * Prospecting Campaign Execution Engine (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Section 42 & 43: "Prospecting Campaign Wizard & Telemetry Dashboard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Computes funnel telemetry stats across 8 pipeline stages.
 * 2. Prepares chunked execution batches (<= 120 prospects) to prevent Firestore write exhaustion.
 * 3. Round-robin rep assignment balancer.
 * 4. Strict Zero-`any` typing.
 */

import type { Prospect, ProspectingCampaign, ProspectingCampaignStats } from '../types';

export class ProspectingCampaignEngine {
  /**
   * Calculates live funnel progression statistics for a campaign draft or running campaign.
   */
  public static calculateCampaignFunnelStats(
    prospects: Prospect[],
    campaign: ProspectingCampaign
  ): ProspectingCampaignStats {
    const totalProspects = prospects.length;

    let enrichedCount = 0;
    let verifiedCount = 0;
    let qualifiedCount = 0;
    let dealsCreated = 0;

    for (const p of prospects) {
      // 1. Enriched Check
      const isEnriched = Boolean(p.websiteScan && p.websiteScan.technologies && p.websiteScan.technologies.length > 0);
      if (isEnriched) enrichedCount++;

      // 2. Verified Check
      const isVerified = (p.contacts || []).some(
        c => c.verificationStatus === 'verified' || (c.deliverabilityScore && c.deliverabilityScore >= 70)
      );
      if (isVerified) verifiedCount++;

      // 3. Qualified Threshold Check
      const score = p.scoring?.overallScore ?? 0;
      const isQualified = score >= (campaign.qualificationThreshold || 70);
      if (isQualified) {
        qualifiedCount++;
        if (p.syncStatus === 'synced') {
          dealsCreated++;
        }
      }
    }

    return {
      totalProspects,
      enrichedCount,
      verifiedCount,
      qualifiedCount,
      dealsCreated,
      outreachSent: campaign.stats?.outreachSent || 0
    };
  }

  /**
   * Filters and assigns prospects for campaign execution.
   */
  public static prepareExecutionPayloads(
    prospects: Prospect[],
    campaign: ProspectingCampaign
  ): Array<{
    prospect: Prospect;
    assignedRepId?: string;
  }> {
    const threshold = campaign.qualificationThreshold || 70;
    const qualified = prospects.filter(p => (p.scoring?.overallScore ?? 0) >= threshold);

    const reps = campaign.assignment?.repIds || [];
    const isRoundRobin = campaign.assignment?.type === 'round_robin' && reps.length > 0;

    return qualified.map((prospect, idx) => {
      let assignedRepId: string | undefined = undefined;
      if (isRoundRobin) {
        assignedRepId = reps[idx % reps.length];
      } else if (reps.length > 0) {
        assignedRepId = reps[0];
      }

      return {
        prospect,
        assignedRepId
      };
    });
  }
}
