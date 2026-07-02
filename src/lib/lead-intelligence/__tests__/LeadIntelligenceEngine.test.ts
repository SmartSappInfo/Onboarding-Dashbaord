import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadIntelligenceEngine } from '../LeadIntelligenceEngine';
import type { LeadIntelligenceSettings, SearchFilters } from '../types';

// Mock genkit flow import
vi.mock('@/ai/flows/lead-enrichment-flow', () => {
  return {
    leadEnrichmentFlow: vi.fn().mockImplementation(async () => {
      return {
        websiteScan: {
          sslValid: true,
          sslExpiresAt: '2027-01-01T00:00:00Z',
          loadTimeMs: 1200,
          metaTitle: 'Sample Title',
          metaDescription: 'Sample Description',
          hasFacebook: true,
          hasInstagram: false,
          hasLinkedIn: true,
          hasTwitter: false,
          brokenLinks: []
        },
        contacts: [
          {
            name: 'John Doe',
            email: 'john@example.edu',
            phone: '123-456-7890',
            role: 'IT Administrator',
            confidence: 95,
            verificationStatus: 'verified' as const
          }
        ],
        scoring: {
          overallScore: 88,
          needScore: 22,
          digitalMaturity: 12,
          buyingIntent: 18,
          budgetProbability: 14,
          decisionMakerFound: 9,
          engagement: 13
        },
        aiInsights: {
          summary: 'Enriched mock summary',
          problemsFound: ['Slow load time'],
          opportunities: ['No online Admissions'],
          suggestedProducts: ['Admissions Portal'],
          estimatedRevenueOpportunity: 2400,
          recommendedPitch: 'Elevator pitch text',
          objectionsAnswered: [
            { objection: 'Too expensive', counter: 'Value makes it cheaper' }
          ]
        }
      };
    })
  };
});

// Mock genkit library for AI generation
vi.mock('@/ai/genkit', () => {
  return {
    ai: {
      generate: vi.fn().mockImplementation(async () => {
        return {
          output: {
            prospects: [
              {
                name: 'Simulated School 1',
                domain: 'simschool1.edu',
                address: '123 Main St',
                phone: '123-456-7890',
                rating: 4.2,
                reviewsCount: 15,
                claimed: true,
                industry: 'Education',
                lat: 5.6037,
                lng: -0.1870
              }
            ]
          }
        };
      })
    }
  };
});

describe('LeadIntelligenceEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchProspects', () => {
    it('uses dynamic AI simulation when Google Places API key is missing', async () => {
      const filters: SearchFilters = { city: 'Accra', country: 'Ghana', industry: 'School' };
      const settings: LeadIntelligenceSettings = {};

      const results = await LeadIntelligenceEngine.searchProspects(
        'org-123',
        'ws-456',
        'Schools in Accra',
        filters,
        settings
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toContain('sim_');
      expect(results[0].name).toBe('Simulated School 1');
      expect(results[0].domain).toBe('simschool1.edu');
    });

    it('makes standard fetch queries to Google Places API when API key is provided', async () => {
      const filters: SearchFilters = { city: 'Accra', country: 'Ghana', industry: 'School' };
      const settings: LeadIntelligenceSettings = { googlePlacesApiKey: 'fake-google-key' };

      // Mock global fetch for places search and details lookup
      const globalFetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('place/textsearch/json')) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  place_id: 'real_place_999',
                  name: 'Google Places School',
                  formatted_address: 'Accra Road, Ghana',
                  geometry: { location: { lat: 5.6, lng: -0.19 } },
                  rating: 4.5,
                  user_ratings_total: 25
                }
              ]
            })
          };
        }
        if (url.includes('place/details/json')) {
          return {
            ok: true,
            json: async () => ({
              result: {
                website: 'https://real-places-school.edu',
                formatted_phone_number: '+233 24 000 0000'
              }
            })
          };
        }
        return { ok: false };
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const results = await LeadIntelligenceEngine.searchProspects(
        'org-123',
        'ws-456',
        'Schools in Accra',
        filters,
        settings
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('gplaces_real_place_999');
      expect(results[0].name).toBe('Google Places School');
      expect(results[0].domain).toBe('real-places-school.edu');
      expect(results[0].phone).toBe('+233 24 000 0000');

      vi.unstubAllGlobals();
    });
  });

  describe('enrichProspect', () => {
    it('runs enrichment using external BuiltWith & Hunter.io endpoints when configured', async () => {
      const prospect = {
        id: 'real_place_999',
        organizationId: 'org-123',
        workspaceId: 'ws-456',
        name: 'Google Places School',
        domain: 'school.edu',
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
        syncStatus: 'unregistered' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const settings: LeadIntelligenceSettings = {
        builtwithApiKey: 'fake-bw-key',
        hunterApiKey: 'fake-hunter-key'
      };

      const globalFetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.builtwith.com')) {
          return {
            ok: true,
            json: async () => ({
              Paths: [
                {
                  Technologies: [
                    { Name: 'WordPress' },
                    { Name: 'Cloudflare' }
                  ]
                }
              ]
            })
          };
        }
        if (url.includes('api.hunter.io')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                emails: [
                  {
                    value: 'principal@school.edu',
                    first_name: 'Jane',
                    last_name: 'Smith',
                    position: 'Principal',
                    confidence: 98,
                    verification_status: 'deliverable'
                  }
                ]
              }
            })
          };
        }
        return { ok: false };
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const enriched = await LeadIntelligenceEngine.enrichProspect(prospect, settings);

      expect(enriched.websiteScan?.technologies).toContain('wordpress');
      expect(enriched.websiteScan?.technologies).toContain('cloudflare');
      expect(enriched.contacts.length).toBe(1);
      expect(enriched.contacts[0].email).toBe('principal@school.edu');
      expect(enriched.contacts[0].name).toBe('Jane Smith');
      expect(enriched.contacts[0].role).toBe('Principal');

      vi.unstubAllGlobals();
    });
  });
});
