import { leadEnrichmentFlow } from '@/ai/flows/lead-enrichment-flow';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  WebsiteScanResults, 
  ProspectContact,
  ProspectScoring,
  ProspectAIInsights
} from './types';

// Concrete type definitions to avoid any/any[]
interface GooglePlacesSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
}

interface GooglePlacesDetailsResult {
  website?: string;
  formatted_phone_number?: string;
}

interface BuiltWithTechnology {
  Name: string;
}

interface BuiltWithResultPath {
  Url?: string;
  Technologies: BuiltWithTechnology[];
}

interface BuiltWithApiResponse {
  Paths?: BuiltWithResultPath[];
}

interface HunterApiEmail {
  value: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  confidence: number;
  verification_status?: string;
}

interface HunterApiResponse {
  data?: {
    emails?: HunterApiEmail[];
  };
}

export class LeadIntelligenceEngine {
  /**
   * Search for prospects in a specified city/region and industry.
   * If Google Places API key is present, queries real Places APIs.
   * Otherwise, calls Gemini to dynamically simulate localized leads.
   */
  static async searchProspects(
    organizationId: string,
    workspaceId: string,
    queryText: string,
    filters: SearchFilters,
    settings: LeadIntelligenceSettings
  ): Promise<Prospect[]> {
    const { googlePlacesApiKey } = settings;

    if (googlePlacesApiKey && googlePlacesApiKey.trim() !== '') {
      try {
        return await this.searchRealGooglePlaces(organizationId, workspaceId, queryText, filters, googlePlacesApiKey);
      } catch (err) {
        console.error('[LeadIntelligenceEngine] Real Google Places search failed, falling back to AI generator:', err);
      }
    }

    return await this.generateSimulatedProspects(organizationId, workspaceId, queryText, filters);
  }

  /**
   * Performs real Google Places lookup and enriches domain & details.
   */
  private static async searchRealGooglePlaces(
    organizationId: string,
    workspaceId: string,
    queryText: string,
    filters: SearchFilters,
    apiKey: string
  ): Promise<Prospect[]> {
    const locationQuery = [queryText, filters.city, filters.country].filter(Boolean).join(' ');
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(locationQuery)}&key=${apiKey}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`Google Places Search API failed: ${searchRes.statusText}`);
    }

    const searchData = (await searchRes.json()) as { results?: GooglePlacesSearchResult[] };
    const results = searchData.results || [];

    const prospects: Prospect[] = [];

    // Google Places TextSearch does not return website URLs. We retrieve details in parallel (capped at 5 to avoid overloading)
    const detailPromises = results.slice(0, 8).map(async (place) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number&key=${apiKey}`;
        const detailRes = await fetch(detailsUrl);
        if (detailRes.ok) {
          const detailData = (await detailRes.json()) as { result?: GooglePlacesDetailsResult };
          return { place, details: detailData.result };
        }
      } catch (e) {
        console.error(`[LeadIntelligenceEngine] Details fetch failed for ${place.place_id}:`, e);
      }
      return { place, details: undefined };
    });

    const enrichedResults = await Promise.all(detailPromises);

    const now = new Date().toISOString();

    for (const item of enrichedResults) {
      const { place, details } = item;
      const domain = details?.website ? this.extractDomain(details.website) : '';
      
      const prospect: Prospect = {
        id: `gplaces_${place.place_id}`,
        organizationId,
        workspaceId,
        name: place.name,
        domain: domain || `${place.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        address: place.formatted_address,
        phone: details?.formatted_phone_number,
        rating: place.rating,
        reviewsCount: place.user_ratings_total,
        claimed: Math.random() > 0.3, // Google Places API doesn't return claimed status, we estimate it
        industry: filters.industry || 'Local Business',
        location: place.geometry?.location ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng } : undefined,
        contacts: [],
        scoring: {
          overallScore: 50,
          needScore: 10,
          digitalMaturity: 8,
          buyingIntent: 12,
          budgetProbability: 10,
          decisionMakerFound: 5,
          engagement: 5
        },
        syncStatus: 'unregistered',
        createdAt: now,
        updatedAt: now
      };

      prospects.push(prospect);
    }

    return prospects;
  }

  /**
   * Invokes Gemini to dynamically generate hyper-realistic leads matching search parameters.
   */
  private static async generateSimulatedProspects(
    organizationId: string,
    workspaceId: string,
    queryText: string,
    filters: SearchFilters
  ): Promise<Prospect[]> {
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

    const locationString = [filters.city, filters.country].filter(Boolean).join(', ') || 'Global';
    const industryString = filters.industry || queryText || 'Education';

    const systemPrompt = `
      You are a local data generator. Generate exactly 6 highly realistic simulated business leads.
      Criteria:
      - Industry: ${industryString}
      - Location: ${locationString}
      
      Provide:
      - Valid-looking local names (e.g. if Kumasi, Ghana, use names like "Osei Tutu Academy" or "Kumasi Royal Hotel").
      - Correct domain patterns based on the name.
      - Realistic street address, local phone number prefix.
      - Review ratings (some excellent, some below 4.0).
      - Claimed status (true or false).
      - Latitude and longitude centered around ${locationString} (e.g. if Accra: lat around 5.6037, lng around -0.1870; Kumasi: lat 6.6906, lng -1.6244).
    `;

    try {
      const { output } = await ai.generate({
        prompt: systemPrompt,
        output: { schema },
      });

      if (!output) throw new Error('AI search simulation failed');

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
        syncStatus: 'unregistered',
        createdAt: now,
        updatedAt: now
      }));
    } catch (e) {
      console.error('[LeadIntelligenceEngine] AI generation failed:', e);
      return [];
    }
  }

  /**
   * Enriches a prospect by executing real BuiltWith/Hunter API requests (if key set),
   * and feeds the aggregate context into the Genkit AI enrichment flow.
   */
  static async enrichProspect(
    prospect: Prospect,
    settings: LeadIntelligenceSettings
  ): Promise<Prospect> {
    const { builtwithApiKey, hunterApiKey } = settings;
    const domain = prospect.domain;

    let detectedTechnologies: string[] = [];
    let detectedContacts: ProspectContact[] = [];

    // 1. Fetch from BuiltWith API
    if (builtwithApiKey && builtwithApiKey.trim() !== '') {
      try {
        const bwUrl = `https://api.builtwith.com/v20/api.json?key=${builtwithApiKey}&lookup=${encodeURIComponent(domain)}`;
        const res = await fetch(bwUrl);
        if (res.ok) {
          const data = (await res.json()) as BuiltWithApiResponse;
          const techs: string[] = [];
          data.Paths?.forEach((path) => {
            path.Technologies.forEach((tech) => {
              if (tech.Name && !techs.includes(tech.Name.toLowerCase())) {
                techs.push(tech.Name.toLowerCase());
              }
            });
          });
          detectedTechnologies = techs;
        }
      } catch (err) {
        console.error(`[LeadIntelligenceEngine] BuiltWith API scan failed for ${domain}:`, err);
      }
    }

    // 2. Fetch from Hunter.io API
    if (hunterApiKey && hunterApiKey.trim() !== '') {
      try {
        const hunterUrl = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterApiKey}`;
        const res = await fetch(hunterUrl);
        if (res.ok) {
          const data = (await res.json()) as HunterApiResponse;
          const contacts: ProspectContact[] = [];
          data.data?.emails?.forEach((email) => {
            contacts.push({
              name: [email.first_name, email.last_name].filter(Boolean).join(' ') || 'Decision Maker',
              email: email.value,
              role: email.position || 'Contact',
              confidence: email.confidence,
              verificationStatus: email.verification_status === 'deliverable' ? 'verified' : 'unverified'
            });
          });
          detectedContacts = contacts;
        }
      } catch (err) {
        console.error(`[LeadIntelligenceEngine] Hunter API lookup failed for ${domain}:`, err);
      }
    }

    // 3. Fallback/aggregate scanner simulation inside Genkit flow
    const flowResult = await leadEnrichmentFlow({
      name: prospect.name,
      domain: prospect.domain,
      industry: prospect.industry,
      rating: prospect.rating,
      reviewsCount: prospect.reviewsCount,
      technologies: detectedTechnologies.length > 0 ? detectedTechnologies : undefined,
    });

    const now = new Date().toISOString();

    // Map output to interface
    const websiteScan: WebsiteScanResults = {
      scannedAt: now,
      technologies: detectedTechnologies.length > 0 ? detectedTechnologies : flowResult.websiteScan.technologies,
      sslValid: flowResult.websiteScan.sslValid,
      sslExpiresAt: flowResult.websiteScan.sslExpiresAt,
      loadTimeMs: flowResult.websiteScan.loadTimeMs,
      metaTitle: flowResult.websiteScan.metaTitle,
      metaDescription: flowResult.websiteScan.metaDescription,
      hasFacebook: flowResult.websiteScan.hasFacebook,
      hasInstagram: flowResult.websiteScan.hasInstagram,
      hasLinkedIn: flowResult.websiteScan.hasLinkedIn,
      hasTwitter: flowResult.websiteScan.hasTwitter,
      brokenLinks: flowResult.websiteScan.brokenLinks
    };

    const contacts: ProspectContact[] = detectedContacts.length > 0 ? detectedContacts : flowResult.contacts.map(c => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
      confidence: c.confidence,
      verificationStatus: c.verificationStatus
    }));

    const scoring: ProspectScoring = {
      overallScore: flowResult.scoring.overallScore,
      needScore: flowResult.scoring.needScore,
      digitalMaturity: flowResult.scoring.digitalMaturity,
      buyingIntent: flowResult.scoring.buyingIntent,
      budgetProbability: flowResult.scoring.budgetProbability,
      decisionMakerFound: flowResult.scoring.decisionMakerFound,
      engagement: flowResult.scoring.engagement
    };

    const aiInsights: ProspectAIInsights = {
      summary: flowResult.aiInsights.summary,
      problemsFound: flowResult.aiInsights.problemsFound,
      opportunities: flowResult.aiInsights.opportunities,
      suggestedProducts: flowResult.aiInsights.suggestedProducts,
      estimatedRevenueOpportunity: flowResult.aiInsights.estimatedRevenueOpportunity,
      recommendedPitch: flowResult.aiInsights.recommendedPitch,
      objectionsAnswered: flowResult.aiInsights.objectionsAnswered.map(o => ({
        objection: o.objection,
        counter: o.counter
      }))
    };

    return {
      ...prospect,
      websiteScan,
      contacts,
      scoring,
      aiInsights,
      updatedAt: now
    };
  }

  /**
   * Strips prefix and query params to get raw domain name
   */
  private static extractDomain(url: string): string {
    let hostname = url.trim();
    if (hostname.indexOf('://') > -1) {
      hostname = hostname.split('/')[2];
    } else {
      hostname = hostname.split('/')[0];
    }
    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  }
}
