/**
 * Multi-Vendor Waterfall Data Enrichment Engine
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. PRD Phase 2 Alignment: Implements sequential waterfall enrichment across Hunter, Apollo, DOM Scraper, BuiltWith, and AI.
 * 2. Cost & Latency Optimization: Short-circuits when high-confidence data (>=80%) is retrieved.
 * 3. Provenance & Transparency: Records step-by-step audit logs (WaterfallStepLog[]) for RevOps inspection.
 * 4. Strict Typing: Zero any/any[], 100% strictly typed with WaterfallEnrichmentResult.
 */

import type { 
  Prospect, 
  LeadIntelligenceSettings, 
  WaterfallStepLog, 
  WaterfallEnrichmentResult,
  ProvenanceRecord 
} from '../types';
import { DOMScraperService } from '../scraper/DOMScraperService';
import { canonicalizeDomain } from '../identity-resolver';

export class WaterfallEnrichmentEngine {
  private static readonly PROVIDER_TIMEOUT_MS = 2500;

  /**
   * Executes the full waterfall enrichment pipeline on a prospect.
   */
  public static async executeWaterfall(
    prospect: Prospect,
    settings: LeadIntelligenceSettings,
    runGenkitFlow?: (p: Prospect) => Promise<Prospect>
  ): Promise<WaterfallEnrichmentResult> {
    const startTime = Date.now();
    const steps: WaterfallStepLog[] = [];
    const provenance: ProvenanceRecord[] = [];
    let creditsUsed = 0;

    let enriched: Prospect = { ...prospect, contacts: [...prospect.contacts] };
    const domain = canonicalizeDomain(prospect.domain);

    // =========================================================================
    // STAGE 1: TECHNOGRAPHICS & LIVE DOM SIGNATURE WATERFALL
    // =========================================================================
    const techSet = new Set<string>(enriched.websiteScan?.technologies || []);

    // 1A. BuiltWith API Lookup (Primary)
    if (settings.builtwithApiKey && domain) {
      const stepStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.PROVIDER_TIMEOUT_MS);

        const bwRes = await fetch(`https://api.builtwith.com/v20/api.json?KEY=${settings.builtwithApiKey}&LOOKUP=${domain}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (bwRes.ok) {
          const data = (await bwRes.json()) as { Paths?: Array<{ Technologies?: Array<{ Name?: string }> }>; Results?: Array<{ Result?: { Paths?: Array<{ Technologies?: Array<{ Name?: string }> }> } }> };
          const paths = data.Paths || data.Results?.[0]?.Result?.Paths || [];
          let foundTechs = 0;
          for (const path of paths) {
            for (const tech of path.Technologies || []) {
              if (tech.Name) {
                techSet.add(tech.Name.toLowerCase());
                foundTechs++;
              }
            }
          }

          if (foundTechs > 0) {
            creditsUsed += 1;
            steps.push({
              stage: 'technographics',
              provider: 'builtwith',
              status: 'hit',
              latencyMs: Date.now() - stepStart,
              matchCount: foundTechs
            });
            provenance.push({
              source: 'builtwith',
              observedAt: new Date().toISOString(),
              field: 'technologies',
              confidence: 0.95
            });
          } else {
            steps.push({
              stage: 'technographics',
              provider: 'builtwith',
              status: 'miss',
              latencyMs: Date.now() - stepStart,
              matchCount: 0
            });
          }
        } else {
          steps.push({
            stage: 'technographics',
            provider: 'builtwith',
            status: 'error',
            latencyMs: Date.now() - stepStart,
            matchCount: 0,
            error: `HTTP ${bwRes.status}`
          });
        }
      } catch (err: unknown) {
        steps.push({
          stage: 'technographics',
          provider: 'builtwith',
          status: 'timeout',
          latencyMs: Date.now() - stepStart,
          matchCount: 0,
          error: err instanceof Error ? err.message : 'Timeout'
        });
      }
    }

    // 1B. DOM Scraper Signature Analysis (Secondary / Complementary)
    if (domain) {
      const stepStart = Date.now();
      try {
        const scraped = await DOMScraperService.scrapeDomain(domain);
        let domHits = 0;

        for (const sig of scraped.paymentSignatures) {
          techSet.add(`Payment Gateway: ${sig.provider.toUpperCase()}`);
          domHits++;
        }

        // Apply scraped metadata to prospect
        enriched.websiteScan = {
          scannedAt: scraped.scannedAt,
          technologies: Array.from(techSet),
          sslValid: enriched.websiteScan?.sslValid ?? true,
          metaTitle: scraped.title || enriched.websiteScan?.metaTitle,
          metaDescription: scraped.metaDescription || enriched.websiteScan?.metaDescription,
          hasFacebook: Boolean(scraped.socialLinks.facebook || enriched.websiteScan?.hasFacebook),
          hasInstagram: Boolean(scraped.socialLinks.instagram || enriched.websiteScan?.hasInstagram),
          hasLinkedIn: Boolean(scraped.socialLinks.linkedin || enriched.websiteScan?.hasLinkedIn),
          hasTwitter: Boolean(scraped.socialLinks.twitter || enriched.websiteScan?.hasTwitter)
        };

        // Add detected emails from on-page scrape if missing
        if (scraped.detectedEmails.length > 0 && enriched.contacts.length === 0) {
          for (const email of scraped.detectedEmails.slice(0, 3)) {
            enriched.contacts.push({
              name: 'General Inquiries',
              email,
              role: 'Contact',
              confidence: 0.75,
              verificationStatus: 'unverified'
            });
          }
        }

        steps.push({
          stage: 'technographics',
          provider: 'dom_scraper',
          status: domHits > 0 || Boolean(scraped.title) ? 'hit' : 'miss',
          latencyMs: Date.now() - stepStart,
          matchCount: domHits
        });
      } catch {
        steps.push({
          stage: 'technographics',
          provider: 'dom_scraper',
          status: 'error',
          latencyMs: Date.now() - stepStart,
          matchCount: 0
        });
      }
    }

    // =========================================================================
    // STAGE 2: DECISION MAKER & EMAIL WATERFALL
    // =========================================================================
    let verifiedEmailFound = enriched.contacts.some(c => c.verificationStatus === 'verified' && c.confidence >= 0.8);

    // 2A. Hunter.io API Lookup (Primary Email Provider)
    if (!verifiedEmailFound && settings.hunterApiKey && domain) {
      const stepStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.PROVIDER_TIMEOUT_MS);

        const hunterRes = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${settings.hunterApiKey}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (hunterRes.ok) {
          const data = (await hunterRes.json()) as { data?: { emails?: Array<{ first_name?: string; last_name?: string; value?: string; position?: string; confidence?: number }> } };
          const emails = data.data?.emails || [];

          if (emails.length > 0) {
            creditsUsed += 1;
            const newContacts = emails.slice(0, 5).map(e => ({
              name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Executive Contact',
              email: e.value || '',
              role: e.position || 'Decision Maker',
              confidence: (e.confidence || 70) / 100,
              verificationStatus: ((e.confidence || 0) > 80 ? 'verified' : 'unverified') as 'verified' | 'unverified'
            }));

            enriched.contacts = newContacts;
            verifiedEmailFound = newContacts.some(c => c.verificationStatus === 'verified');

            steps.push({
              stage: 'email',
              provider: 'hunter',
              status: 'hit',
              latencyMs: Date.now() - stepStart,
              matchCount: newContacts.length
            });
            provenance.push({
              source: 'hunter',
              observedAt: new Date().toISOString(),
              field: 'contacts',
              confidence: 0.90
            });
          } else {
            steps.push({
              stage: 'email',
              provider: 'hunter',
              status: 'miss',
              latencyMs: Date.now() - stepStart,
              matchCount: 0
            });
          }
        }
      } catch (err: unknown) {
        steps.push({
          stage: 'email',
          provider: 'hunter',
          status: 'timeout',
          latencyMs: Date.now() - stepStart,
          matchCount: 0,
          error: err instanceof Error ? err.message : 'Timeout'
        });
      }
    }

    // 2B. Apollo.io API Lookup (Secondary Email Provider)
    if (!verifiedEmailFound && settings.apolloApiKey && domain) {
      const stepStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.PROVIDER_TIMEOUT_MS);

        const apolloRes = await fetch('https://api.apollo.io/v1/organizations/enrich', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': settings.apolloApiKey
          },
          body: JSON.stringify({ domain }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (apolloRes.ok) {
          const data = (await apolloRes.json()) as { organization?: { phone?: string; estimated_num_employees?: number } };
          if (data.organization?.phone && !enriched.phone) {
            enriched.phone = data.organization.phone;
          }
          creditsUsed += 1;
          steps.push({
            stage: 'firmographics',
            provider: 'apollo',
            status: 'hit',
            latencyMs: Date.now() - stepStart,
            matchCount: 1
          });
        } else {
          steps.push({
            stage: 'firmographics',
            provider: 'apollo',
            status: 'miss',
            latencyMs: Date.now() - stepStart,
            matchCount: 0
          });
        }
      } catch {
        steps.push({
          stage: 'firmographics',
          provider: 'apollo',
          status: 'timeout',
          latencyMs: Date.now() - stepStart,
          matchCount: 0
        });
      }
    }

    // =========================================================================
    // STAGE 3: AI STETHOSCOPE SYNTHESIS (Gemini / Claude Fallback)
    // =========================================================================
    if (runGenkitFlow) {
      const stepStart = Date.now();
      try {
        enriched = await runGenkitFlow(enriched);
        creditsUsed += 1;
        steps.push({
          stage: 'ai_synthesis',
          provider: 'gemini_genkit',
          status: 'hit',
          latencyMs: Date.now() - stepStart,
          matchCount: 1
        });
      } catch (err: unknown) {
        steps.push({
          stage: 'ai_synthesis',
          provider: 'gemini_genkit',
          status: 'error',
          latencyMs: Date.now() - stepStart,
          matchCount: 0,
          error: err instanceof Error ? err.message : 'AI flow failure'
        });
      }
    }

    enriched.provenance = provenance;
    enriched.updatedAt = new Date().toISOString();

    return {
      prospect: enriched,
      steps,
      totalCreditsUsed: creditsUsed,
      totalDurationMs: Date.now() - startTime
    };
  }
}
