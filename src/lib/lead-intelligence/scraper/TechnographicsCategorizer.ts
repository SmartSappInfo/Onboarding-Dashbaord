/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 4):
 * 
 * TechnographicsCategorizer parses raw technology arrays from BuiltWith and DOM Scraping
 * into 5 structured business categories (CMS, Payments, Portals, Communication, Analytics),
 * identifies payment gaps, and computes the 4-dimension enrichment completion scores.
 * 
 * Invariants & Safeguards:
 * 1. Normalized Matching: Case-insensitive token lookup against category dictionaries.
 * 2. Payment Gap Heuristic: Flags institutions with admissions/commerce presence lacking payment gateways.
 * 3. 4-Dimension Metric: Computes 0-100% completion scores for Firmographics, Tech, Contacts, and Verification.
 * 4. Strict Typing: Zero `any` or `any[]`.
 */

import type { 
  Prospect, 
  CategorizedTechStack, 
  SubdomainProbeResult, 
  EnrichmentDimensionScore 
} from '../types';

export class TechnographicsCategorizer {
  private static readonly CMS_SIGNATURES = [
    'wordpress', 'woocommerce', 'shopify', 'next.js', 'react', 'webflow', 
    'wix', 'squarespace', 'laravel', 'drupal', 'joomla', 'ghost', 'magento', 'elementor'
  ];

  private static readonly PAYMENT_SIGNATURES = [
    'paystack', 'flutterwave', 'hubtel', 'stripe', 'mtn', 'momo', 
    'mobile money', 'vodafone cash', 'airteltigo', 'paypal', 'razorpay', 'authorize.net', 'payment gateway'
  ];

  private static readonly COMMUNICATION_SIGNATURES = [
    'whatsapp', 'tawk.to', 'intercom', 'zendesk', 'livechat', 
    'crisp', 'jivochat', 'freshdesk', 'tidio', 'facebook chat'
  ];

  private static readonly ANALYTICS_SIGNATURES = [
    'google analytics', 'ga4', 'google tag manager', 'meta pixel', 
    'facebook pixel', 'hotjar', 'microsoft clarity', 'mixpanel', 'segment'
  ];

  /**
   * Categorizes raw technology strings and probed subdomains into structured buckets.
   */
  public static categorize(
    technologies: string[] = [],
    probedPortals: SubdomainProbeResult[] = []
  ): CategorizedTechStack {
    const cmsSet = new Set<string>();
    const paymentsSet = new Set<string>();
    const communicationSet = new Set<string>();
    const analyticsSet = new Set<string>();

    for (const tech of technologies) {
      const lower = tech.toLowerCase();

      if (this.CMS_SIGNATURES.some(sig => lower.includes(sig))) {
        cmsSet.add(tech);
      }
      if (this.PAYMENT_SIGNATURES.some(sig => lower.includes(sig))) {
        paymentsSet.add(tech);
      }
      if (this.COMMUNICATION_SIGNATURES.some(sig => lower.includes(sig))) {
        communicationSet.add(tech);
      }
      if (this.ANALYTICS_SIGNATURES.some(sig => lower.includes(sig))) {
        analyticsSet.add(tech);
      }
    }

    const payments = Array.from(paymentsSet);
    const hasCommerceOrAdmissions = technologies.some(t => {
      const l = t.toLowerCase();
      return l.includes('woocommerce') || l.includes('shopify') || l.includes('ecommerce') || l.includes('admissions');
    });

    const paymentGapDetected = hasCommerceOrAdmissions && payments.length === 0;
    const missingPortalDetected = probedPortals.length === 0;

    return {
      cms: Array.from(cmsSet),
      payments,
      portals: probedPortals,
      communication: Array.from(communicationSet),
      analytics: Array.from(analyticsSet),
      paymentGapDetected,
      missingPortalDetected
    };
  }

  /**
   * Computes the 4-dimension enrichment scores for a Prospect (UI Spec Section 22).
   */
  public static calculateEnrichmentDimensions(prospect: Prospect): EnrichmentDimensionScore {
    // Dimension 1: Company Firmographics (Name, Domain, Phone, Address, Rating)
    let companyScore = 0;
    if (prospect.name) companyScore += 25;
    if (prospect.domain) companyScore += 25;
    if (prospect.phone) companyScore += 25;
    if (prospect.address) companyScore += 25;

    // Dimension 2: Technology Stack (CMS, Payments, Socials, SSL)
    let techScore = 0;
    const techCount = prospect.websiteScan?.technologies?.length || 0;
    if (techCount > 0) techScore += 40;
    if (techCount >= 3) techScore += 20;
    if (prospect.websiteScan?.sslValid) techScore += 20;
    if (
      prospect.websiteScan?.hasFacebook || 
      prospect.websiteScan?.hasInstagram || 
      prospect.websiteScan?.hasLinkedIn || 
      prospect.websiteScan?.hasTwitter
    ) {
      techScore += 20;
    }

    // Dimension 3: Contacts & Decision Makers
    let contactsScore = 0;
    const contactCount = prospect.contacts?.length || 0;
    if (contactCount > 0) contactsScore += 50;
    if (contactCount >= 2) contactsScore += 25;
    const hasVerified = prospect.contacts?.some(c => c.verificationStatus === 'verified');
    if (hasVerified) contactsScore += 25;

    // Dimension 4: Verification & Deliverability
    let verificationScore = 0;
    if (prospect.websiteScan?.sslValid) verificationScore += 30;
    if (prospect.claimed) verificationScore += 30;
    if (hasVerified) verificationScore += 40;

    const overallEnrichmentPercent = Math.round(
      (companyScore * 0.3) + 
      (techScore * 0.3) + 
      (contactsScore * 0.25) + 
      (verificationScore * 0.15)
    );

    return {
      companyScore: Math.min(100, companyScore),
      techScore: Math.min(100, techScore),
      contactsScore: Math.min(100, contactsScore),
      verificationScore: Math.min(100, verificationScore),
      overallEnrichmentPercent: Math.min(100, overallEnrichmentPercent)
    };
  }
}
