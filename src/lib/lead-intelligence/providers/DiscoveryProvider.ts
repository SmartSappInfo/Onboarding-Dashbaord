/**
 * Discovery Provider Base Interface & Registry
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Provider Abstraction: All prospect discovery sources (Google Places, AI Simulator, CSV Ingestion, etc.)
 *    must implement the `DiscoveryProvider` interface.
 * 2. Pluggable Architecture: New providers can be added without modifying the core `LeadIntelligenceEngine`.
 */

import type { Prospect, DiscoveryQuery, LeadIntelligenceSettings, DiscoverySourceType } from '../types';

export interface ProviderCapabilities {
  supportsRealData: boolean;
  supportsGeocoding: boolean;
  supportsTechnographics: boolean;
  requiresApiKey: boolean;
  apiKeyName?: keyof LeadIntelligenceSettings;
}

export interface DiscoveryProvider {
  id: DiscoverySourceType;
  name: string;
  getCapabilities(): ProviderCapabilities;
  search(query: DiscoveryQuery, settings: LeadIntelligenceSettings): Promise<Prospect[]>;
}
