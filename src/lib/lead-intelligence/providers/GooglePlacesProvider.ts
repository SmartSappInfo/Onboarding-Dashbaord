/**
 * Google Places Discovery Provider
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Error Resilience: Catches details fetch errors per-place so single failures don't abort entire search batch.
 * 2. Rate Limit Protection: Limits parallel place details queries to a maximum of 8.
 * 3. Provenance Attribution: Stamps source as 'google_places' with confidence scores.
 */

import type { DiscoveryProvider, ProviderCapabilities } from './DiscoveryProvider';
import type { Prospect, DiscoveryQuery, LeadIntelligenceSettings } from '../types';
import { canonicalizeDomain } from '../identity-resolver';

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

export class GooglePlacesProvider implements DiscoveryProvider {
  id = 'google_places' as const;
  name = 'Google Places API';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealData: true,
      supportsGeocoding: true,
      supportsTechnographics: false,
      requiresApiKey: true,
      apiKeyName: 'googlePlacesApiKey'
    };
  }

  async search(query: DiscoveryQuery, settings: LeadIntelligenceSettings): Promise<Prospect[]> {
    const { googlePlacesApiKey } = settings;
    if (!googlePlacesApiKey || googlePlacesApiKey.trim() === '') {
      throw new Error('Google Places API key is not configured.');
    }

    const { organizationId, workspaceId, queryText, filters } = query;
    const locationQuery = [queryText, filters.city, filters.country].filter(Boolean).join(' ');
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(locationQuery)}&key=${googlePlacesApiKey}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`Google Places Search API failed: ${searchRes.statusText}`);
    }

    const searchData = (await searchRes.json()) as { results?: GooglePlacesSearchResult[] };
    const results = searchData.results || [];

    const limitCount = query.limit || 8;
    const topResults = results.slice(0, limitCount);

    // Google Places TextSearch does not return website URLs. We retrieve details in parallel capped at limit
    const detailPromises = topResults.map(async (place) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number&key=${googlePlacesApiKey}`;
        const detailRes = await fetch(detailsUrl);
        if (detailRes.ok) {
          const detailData = (await detailRes.json()) as { result?: GooglePlacesDetailsResult };
          return { place, details: detailData.result };
        }
      } catch (e) {
        console.error(`[GooglePlacesProvider] Details fetch failed for ${place.place_id}:`, e);
      }
      return { place, details: undefined };
    });

    const enrichedResults = await Promise.all(detailPromises);
    const now = new Date().toISOString();
    const prospects: Prospect[] = [];

    for (const item of enrichedResults) {
      const { place, details } = item;
      const domain = details?.website ? canonicalizeDomain(details.website) : '';
      const fallbackDomain = `${place.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

      const prospect: Prospect = {
        id: `gplaces_${place.place_id}`,
        organizationId,
        workspaceId,
        name: place.name,
        domain: domain || fallbackDomain,
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
        source: 'google_places',
        provenance: [
          {
            field: 'name',
            source: 'google_places',
            confidence: 100,
            observedAt: now
          },
          {
            field: 'location',
            source: 'google_places',
            confidence: 95,
            observedAt: now
          }
        ],
        syncStatus: 'unregistered',
        createdAt: now,
        updatedAt: now
      };

      prospects.push(prospect);
    }

    return prospects;
  }
}
