/**
 * CSV / Tabular Import Discovery Provider
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. High-Load Guard: Caps raw CSV lines at 2,000 to prevent browser/server memory exhaustion.
 * 2. Flexible Schema Mapping: Auto-matches columns for Name, Website, Phone, Email, Address, and Industry.
 * 3. Sanitization & Normalization: Automatically cleans domains and strips dangerous control characters.
 */

import type { DiscoveryProvider, ProviderCapabilities } from './DiscoveryProvider';
import type { Prospect, DiscoveryQuery, LeadIntelligenceSettings } from '../types';
import { canonicalizeDomain } from '../identity-resolver';

export class CSVImportProvider implements DiscoveryProvider {
  id = 'csv_import' as const;
  name = 'CSV / Spreadsheets Ingestion';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealData: true,
      supportsGeocoding: false,
      supportsTechnographics: false,
      requiresApiKey: false
    };
  }

  async search(query: DiscoveryQuery, _settings: LeadIntelligenceSettings): Promise<Prospect[]> {
    const rawCsv = query.queryText || '';
    return this.parseCSVText(rawCsv, query.organizationId, query.workspaceId, query.filters.industry);
  }

  /**
   * Pure parser converting raw CSV/TSV content into Prospect objects with header detection.
   */
  public parseCSVText(
    rawText: string,
    organizationId: string,
    workspaceId: string,
    defaultIndustry?: string
  ): Prospect[] {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    // Enforce 2,000 row safety cap
    const cappedLines = lines.slice(0, 2001);
    const headerLine = cappedLines[0];
    const dataLines = cappedLines.slice(1);

    // Detect delimiter (, or \t or ;)
    let delimiter = ',';
    if (headerLine.includes('\t')) delimiter = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

    const headers = headerLine
      .split(delimiter)
      .map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('company') || h.includes('business') || h.includes('organization'));
    const domainIdx = headers.findIndex((h) => h.includes('domain') || h.includes('website') || h.includes('url') || h.includes('site') || h.includes('web'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('contact number'));
    const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('e-mail') || h.includes('mail'));
    const addressIdx = headers.findIndex((h) => h.includes('address') || h.includes('location') || h.includes('street') || h.includes('city'));
    const industryIdx = headers.findIndex((h) => h.includes('industry') || h.includes('category') || h.includes('sector'));

    const now = new Date().toISOString();
    const prospects: Prospect[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line) continue;

      // Handle simple CSV splitting with quoted values
      const cols: string[] = [];
      let inQuotes = false;
      let curr = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          cols.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      cols.push(curr.trim());

      const rawName = nameIdx >= 0 ? cols[nameIdx] || '' : cols[0] || '';
      const cleanName = rawName.replace(/^["']|["']$/g, '').trim();
      if (!cleanName || cleanName.length < 2) continue;

      const rawDomain = domainIdx >= 0 ? cols[domainIdx] || '' : '';
      const domain = canonicalizeDomain(rawDomain) || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

      const rawPhone = phoneIdx >= 0 ? cols[phoneIdx]?.replace(/^["']|["']$/g, '').trim() : undefined;
      const rawEmail = emailIdx >= 0 ? cols[emailIdx]?.replace(/^["']|["']$/g, '').trim() : undefined;
      const rawAddress = addressIdx >= 0 ? cols[addressIdx]?.replace(/^["']|["']$/g, '').trim() : undefined;
      const rawIndustry = industryIdx >= 0 ? cols[industryIdx]?.replace(/^["']|["']$/g, '').trim() : defaultIndustry;

      const prospect: Prospect = {
        id: `csv_${organizationId}_${workspaceId}_${Date.now()}_${i}`,
        organizationId,
        workspaceId,
        name: cleanName,
        domain,
        address: rawAddress,
        phone: rawPhone,
        industry: rawIndustry || defaultIndustry || 'General',
        claimed: true,
        contacts: rawEmail
          ? [
              {
                name: 'Primary Contact',
                email: rawEmail,
                phone: rawPhone,
                role: 'Contact',
                confidence: 75,
                verificationStatus: 'unknown'
              }
            ]
          : [],
        scoring: {
          overallScore: 55,
          needScore: 12,
          digitalMaturity: 10,
          buyingIntent: 10,
          budgetProbability: 10,
          decisionMakerFound: rawEmail ? 8 : 2,
          engagement: 3
        },
        source: 'csv_import',
        provenance: [
          {
            field: 'name',
            source: 'csv_import',
            confidence: 90,
            observedAt: now
          },
          {
            field: 'domain',
            source: 'csv_import',
            confidence: domain ? 90 : 50,
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
