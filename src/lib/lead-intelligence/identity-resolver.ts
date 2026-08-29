/**
 * Identity Resolver & Domain Normalizer for Lead Intelligence 2.0
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Security & Protection: Validates domains against SSRF/loopback targets (e.g. localhost, private IP ranges).
 * 2. Multi-Factor Matching: Compares domain (P1), normalized phone (P2), and fuzzy name similarity (P3).
 * 3. High Performance: Hoists regexes and avoids un-memoized heavy loop operations.
 */

import type { IdentityMatchResult } from './types';

/**
 * List of private IPv4 prefixes and loopback addresses to block for SSRF prevention.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // Cloud metadata service
  'metadata.google.internal',
]);

const PRIVATE_IP_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

const COMMON_LEGAL_SUFFIXES_REGEX = /\b(ltd|limited|llc|inc|incorporated|corp|corporation|plc|gmbh|sa|pvt|co|company|enterprises|ghana|group|international|services)\b/gi;

/**
 * Canonicalizes a raw URL or domain string into a clean root domain hostname.
 * Example: "https://www.myschool.edu.gh/admissions?ref=1" -> "myschool.edu.gh"
 */
export function canonicalizeDomain(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  
  let cleaned = rawUrl.trim().toLowerCase();
  
  // Remove protocol
  if (cleaned.includes('://')) {
    cleaned = cleaned.split('://')[1] || '';
  }
  
  // Remove path fragments and query params
  cleaned = cleaned.split('/')[0] || '';
  cleaned = cleaned.split('?')[0] || '';
  cleaned = cleaned.split('#')[0] || '';
  cleaned = cleaned.split(':')[0] || ''; // remove port
  
  // Remove leading www.
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.substring(4);
  }
  
  return cleaned.trim();
}

/**
 * Validates whether a domain or URL is safe to fetch or scrape externally.
 * Blocks localhost, private IP subnets, and cloud metadata IPs to prevent SSRF vulnerabilities.
 */
export function isSafeExternalDomain(rawUrl: string): boolean {
  const domain = canonicalizeDomain(rawUrl);
  if (!domain || domain.length < 3) return false;
  
  if (BLOCKED_HOSTNAMES.has(domain)) return false;
  if (PRIVATE_IP_REGEX.test(domain)) return false;
  
  // Must have a valid dot structure (e.g. example.com, school.edu.gh)
  if (!domain.includes('.')) return false;
  
  return true;
}

/**
 * Normalizes a company/business name for fuzzy matching by removing punctuation,
 * legal suffixes, and excessive whitespace.
 */
export function normalizeBusinessName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .replace(COMMON_LEGAL_SUFFIXES_REGEX, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Dice-Sørensen coefficient similarity between two strings (0.0 to 1.0).
 * Highly effective for matching business names with word order differences.
 */
export function calculateStringSimilarity(strA: string, strB: string): number {
  const a = normalizeBusinessName(strA);
  const b = normalizeBusinessName(strB);
  
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;
  
  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  
  let intersection = 0;
  bigramsA.forEach((bg) => {
    if (bigramsB.has(bg)) intersection++;
  });
  
  const total = bigramsA.size + bigramsB.size;
  if (total === 0) return 0.0;
  
  return (2.0 * intersection) / total;
}

/**
 * Normalizes phone numbers by stripping non-digits and removing leading national/country prefixes.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let digits = rawPhone.replace(/\D/g, '');
  // If starts with country code 233, strip it
  if (digits.startsWith('233') && digits.length >= 11) {
    digits = digits.substring(3);
  }
  // Strip leading 0 if length is >= 9
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = digits.substring(1);
  }
  return digits;
}

/**
 * Evaluates match confidence between a discovered prospect and an existing CRM entity candidate.
 */
export function evaluateIdentityMatch(
  prospect: { name: string; domain?: string; phone?: string },
  candidate: { displayName?: string; primaryEmail?: string; primaryPhone?: string; slug?: string }
): IdentityMatchResult {
  const prospectDomain = canonicalizeDomain(prospect.domain || '');
  const candidateDomain = canonicalizeDomain(candidate.slug || candidate.primaryEmail?.split('@')[1] || '');
  
  // 1. Exact Domain Match (Highest Confidence: 0.98)
  if (prospectDomain && candidateDomain && prospectDomain === candidateDomain) {
    return {
      isMatch: true,
      confidence: 0.98,
      matchReason: `Exact domain match: ${prospectDomain}`
    };
  }
  
  // 2. Normalized Phone Match (High Confidence: 0.90)
  const normProspectPhone = normalizePhoneNumber(prospect.phone || '');
  const normCandidatePhone = normalizePhoneNumber(candidate.primaryPhone || '');
  if (normProspectPhone.length >= 7 && normProspectPhone === normCandidatePhone) {
    return {
      isMatch: true,
      confidence: 0.90,
      matchReason: `Exact phone number match: ${normProspectPhone}`
    };
  }
  
  // 3. Fuzzy Name Similarity Match (Medium-High Confidence: up to 0.85)
  if (prospect.name && candidate.displayName) {
    const similarity = calculateStringSimilarity(prospect.name, candidate.displayName);
    if (similarity >= 0.82) {
      return {
        isMatch: true,
        confidence: similarity,
        matchReason: `High name similarity (${Math.round(similarity * 100)}%): "${prospect.name}" ~ "${candidate.displayName}"`
      };
    }
  }
  
  return {
    isMatch: false,
    confidence: 0.0,
    matchReason: 'No strong identifier match found'
  };
}
