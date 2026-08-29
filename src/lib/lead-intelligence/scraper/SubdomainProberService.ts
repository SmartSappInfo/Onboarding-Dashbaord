/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 4):
 * 
 * SubdomainProberService provides fast, parallel, SSRF-safe probing of high-value
 * subdomains (e.g. portal, admissions, moodle, fees, sis, app) to detect institution
 * digital infrastructure maturity and critical payment gaps.
 * 
 * Invariants & Safeguards:
 * 1. Zero-Trust SSRF: Validates all target hostnames and redirects against loopback/private subnets.
 * 2. Strict Timeout: Enforces 2,000ms AbortController timeout per subdomain probe.
 * 3. Concurrent Non-blocking Execution: Executes all candidate probes in parallel via Promise.allSettled.
 * 4. Zero `any` or `any[]` typing.
 */

import { isSafeExternalDomain, canonicalizeDomain } from '../identity-resolver';
import type { SubdomainProbeResult } from '../types';

export const HIGH_VALUE_SUBDOMAINS = [
  'portal',
  'admissions',
  'moodle',
  'app',
  'fees',
  'sis',
  'erp',
  'pay',
  'apply'
] as const;

export class SubdomainProberService {
  private static readonly PROBE_TIMEOUT_MS = 2000;

  /**
   * Probes high-value subdomains for a target domain concurrently.
   */
  public static async probeDomain(domain: string): Promise<SubdomainProbeResult[]> {
    const cleanDomain = canonicalizeDomain(domain);
    if (!cleanDomain || !isSafeExternalDomain(cleanDomain)) {
      return [];
    }

    const probePromises = HIGH_VALUE_SUBDOMAINS.map(sub => this.probeSingleSubdomain(sub, cleanDomain));
    const results = await Promise.allSettled(probePromises);

    const successfulProbes: SubdomainProbeResult[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value !== null) {
        successfulProbes.push(res.value);
      }
    }

    return successfulProbes;
  }

  /**
   * Probes a single subdomain with timeout and SSRF guard.
   */
  private static async probeSingleSubdomain(
    subdomain: string,
    rootDomain: string
  ): Promise<SubdomainProbeResult | null> {
    const targetHost = `${subdomain}.${rootDomain}`;
    if (!isSafeExternalDomain(targetHost)) {
      return null;
    }

    const targetUrl = `https://${targetHost}`;
    const startTime = Date.now();
    const detectedAt = new Date().toISOString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SmartSappBot/2.0 (+https://smartsapp.com)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok && response.status !== 401 && response.status !== 403) {
        return null;
      }

      // Check if response redirected to a safe external domain
      if (response.url) {
        const redirectedDomain = canonicalizeDomain(response.url);
        if (!isSafeExternalDomain(redirectedDomain)) {
          return null;
        }
      }

      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
      const title = rawTitle.slice(0, 100);

      const portalType = this.classifyPortalType(subdomain, title, html);

      const status: SubdomainProbeResult['status'] = (response.status === 401 || response.status === 403)
        ? 'auth_required'
        : response.redirected
          ? 'redirect'
          : 'online';

      return {
        subdomain,
        fullUrl: targetUrl,
        status,
        httpStatus: response.status,
        title: title || undefined,
        portalType,
        latencyMs,
        detectedAt
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Classifies the semantic purpose of the detected subdomain.
   */
  private static classifyPortalType(
    subdomain: string,
    title: string,
    html: string
  ): SubdomainProbeResult['portalType'] {
    const text = `${subdomain} ${title} ${html.slice(0, 2000)}`.toLowerCase();

    if (subdomain === 'moodle' || text.includes('moodle') || text.includes('learning management')) {
      return 'lms_moodle';
    }
    if (subdomain === 'admissions' || subdomain === 'apply' || text.includes('admission') || text.includes('application form')) {
      return 'admissions';
    }
    if (subdomain === 'fees' || subdomain === 'pay' || text.includes('fee payment') || text.includes('pay fee')) {
      return 'fee_payment';
    }
    if (subdomain === 'sis' || text.includes('student information system')) {
      return 'student_portal';
    }
    if (subdomain === 'portal' || text.includes('login') || text.includes('sign in')) {
      return 'generic_login';
    }

    return 'student_portal';
  }
}
