/**
 * Simulated AI Discovery Provider (Genkit Gemini with Claude Failover & Mock Registry)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Fallback Resilience: If LLM generation fails or hits quotas, falls back seamlessly to MOCK_GHANA_PROSPECTS.
 * 2. Strict Provenance: Tags records with source 'ai_simulation' and dynamic confidence stamps.
 */

import type { DiscoveryProvider, ProviderCapabilities } from './DiscoveryProvider';
import type { Prospect, DiscoveryQuery, LeadIntelligenceSettings } from '../types';
import { MOCK_GHANA_PROSPECTS } from '../mock-data';

export class SimulatedAIProvider implements DiscoveryProvider {
  id = 'ai_simulation' as const;
  name = 'AI Generator & Local Directory';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealData: false,
      supportsGeocoding: true,
      supportsTechnographics: true,
      requiresApiKey: false
    };
  }

  async search(query: DiscoveryQuery, _settings: LeadIntelligenceSettings): Promise<Prospect[]> {
    const { organizationId, workspaceId, queryText, filters } = query;
    const { ai } = await import('@/ai/genkit');
    const { z } = await import('genkit');

    const schema = z.object({
      prospects: z.array(
        z.object({
          name: z.string(),
          domain: z.string(),
          address: z.string().optional(),
          phone: z.string().optional(),
          rating: z.number().optional(),
          reviewsCount: z.number().optional(),
          claimed: z.boolean(),
          industry: z.string(),
          lat: z.number(),
          lng: z.number(),
        })
      ),
    });

    const locationString = [filters.city, filters.country].filter(Boolean).join(', ') || 'Ghana';
    const industryString = filters.industry || queryText || 'Education';

    const systemPrompt = `
      You are an enterprise prospecting lead generator. Generate exactly 6 highly realistic simulated business leads.
      Criteria:
      - Industry: ${industryString}
      - Location: ${locationString}
      
      Provide:
      - Valid-looking local names (e.g. if Kumasi, Ghana, use names like "Osei Tutu International Academy" or "Kumasi Premier Institute").
      - Clean domain patterns based on the name.
      - Realistic street address, local phone number prefix.
      - Review ratings (some excellent, some below 4.0).
      - Claimed status (true or false).
      - Latitude and longitude centered around ${locationString} (e.g. if Accra: lat 5.6037, lng -0.1870; Kumasi: lat 6.6906, lng -1.6244).
    `;

    try {
      const { output } = await ai.generate({
        prompt: systemPrompt,
        output: { schema },
      });

      if (!output || !output.prospects || output.prospects.length === 0) {
        throw new Error('AI search simulation returned empty output');
      }

      const now = new Date().toISOString();
      return output.prospects.map((p, index) => ({
        id: `sim_${organizationId}_${workspaceId}_${Date.now()}_${index}`,
        organizationId,
        workspaceId,
        name: p.name,
        domain: p.domain,
        address: p.address,
        phone: p.phone,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        claimed: p.claimed,
        industry: p.industry,
        location: { lat: p.lat, lng: p.lng },
        contacts: [],
        scoring: {
          overallScore: 40 + Math.floor(Math.random() * 40),
          needScore: 10 + Math.floor(Math.random() * 10),
          digitalMaturity: 5 + Math.floor(Math.random() * 8),
          buyingIntent: 8 + Math.floor(Math.random() * 10),
          budgetProbability: 8 + Math.floor(Math.random() * 6),
          decisionMakerFound: 3 + Math.floor(Math.random() * 7),
          engagement: 2 + Math.floor(Math.random() * 10)
        },
        source: 'ai_simulation',
        provenance: [
          {
            field: 'name',
            source: 'ai_simulation',
            confidence: 85,
            observedAt: now
          }
        ],
        syncStatus: 'unregistered',
        createdAt: now,
        updatedAt: now
      }));
    } catch (e) {
      console.error('[SimulatedAIProvider] AI generation failed, falling back to static registry:', e);
      const now = new Date().toISOString();
      return MOCK_GHANA_PROSPECTS.map((p, index) => ({
        ...p,
        id: `sim_${organizationId}_${workspaceId}_${Date.now()}_${index}`,
        organizationId,
        workspaceId,
        source: 'ai_simulation' as const,
        provenance: [
          {
            field: 'name',
            source: 'ai_simulation',
            confidence: 80,
            observedAt: now
          }
        ],
        createdAt: now,
        updatedAt: now
      }));
    }
  }
}
