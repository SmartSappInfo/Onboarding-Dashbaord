/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 5):
 * 
 * DNSMXResolverService performs asynchronous DNS MX record resolution and
 * fingerprints corporate email hosting providers (Google Workspace, Microsoft 365, Zoho, etc.).
 * 
 * Invariants & Safeguards:
 * 1. Strict Timeout: 1,500ms timeout ceiling using Promise.race.
 * 2. Provider Classification: Detects Google Workspace, Microsoft 365, Zoho, and ProtonMail.
 * 3. Graceful Fallback: Returns structured error if domain has no active mail exchanger.
 * 4. Strict Typing: Zero `any` or `any[]`.
 */

import dns from 'node:dns';
import type { MXProviderType } from '../types';

export interface MXResolutionResult {
  hasMx: boolean;
  primaryHost?: string;
  allHosts: string[];
  provider: MXProviderType;
  latencyMs: number;
  error?: string;
}

export class DNSMXResolverService {
  private static readonly DNS_TIMEOUT_MS = 1500;

  /**
   * Resolves MX records for a target domain.
   */
  public static async resolveMX(domain: string): Promise<MXResolutionResult> {
    if (!domain) {
      return {
        hasMx: false,
        allHosts: [],
        provider: 'unknown',
        latencyMs: 0,
        error: 'Domain is required'
      };
    }

    const startTime = Date.now();

    try {
      const dnsPromise = dns.promises.resolveMx(domain);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS MX resolution timed out')), this.DNS_TIMEOUT_MS)
      );

      const records = await Promise.race([dnsPromise, timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      if (!records || records.length === 0) {
        return {
          hasMx: false,
          allHosts: [],
          provider: 'unknown',
          latencyMs,
          error: 'No MX records configured for this domain'
        };
      }

      // Sort by priority ascending (lower number = higher preference)
      const sortedRecords = [...records].sort((a, b) => a.priority - b.priority);
      const allHosts = sortedRecords.map(r => r.exchange.toLowerCase().trim());
      const primaryHost = allHosts[0] || '';

      const provider = this.fingerprintProvider(allHosts);

      return {
        hasMx: true,
        primaryHost,
        allHosts,
        provider,
        latencyMs
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      return {
        hasMx: false,
        allHosts: [],
        provider: 'unknown',
        latencyMs,
        error: err instanceof Error ? err.message : 'DNS resolution failed'
      };
    }
  }

  /**
   * Identifies enterprise email providers based on MX host signatures.
   */
  private static fingerprintProvider(hosts: string[]): MXProviderType {
    const combined = hosts.join(' ').toLowerCase();

    if (combined.includes('google.com') || combined.includes('googlemail.com') || combined.includes('aspmx')) {
      return 'google_workspace';
    }
    if (combined.includes('outlook.com') || combined.includes('protection.outlook.com') || combined.includes('office365')) {
      return 'microsoft_365';
    }
    if (combined.includes('zoho.com') || combined.includes('zoho.eu') || combined.includes('zohomail')) {
      return 'zoho';
    }
    if (combined.includes('protonmail.ch') || combined.includes('proton.me')) {
      return 'protonmail';
    }

    return 'cpanel_custom';
  }
}
