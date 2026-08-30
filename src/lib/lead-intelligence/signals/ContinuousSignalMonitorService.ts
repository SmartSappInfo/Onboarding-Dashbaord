/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 7):
 * 
 * ContinuousSignalMonitorService is the core delta detection engine that compares
 * periodic scans of a prospect against its baseline snapshot.
 * 
 * It identifies high-value buying moments and intent triggers:
 * 1. Payment Gateway Removed / Payment Gap Detected (🔥 Critical Intent)
 * 2. New Subdomain Portal Deployed (↑ High Technographic Change)
 * 3. New Key Decision Maker Identified / Verified (👤 Leadership Change)
 * 4. SSL Certificate Expiring / Vulnerability (⚠️ Compliance Alert)
 * 5. CMS Redesign / Shift (↑ Infrastructure Change)
 * 
 * Invariants & Safeguards:
 * 1. Semantic normalization prevents false positives caused by trivial whitespace changes.
 * 2. Deterministic signal IDs and deduplication keys prevent repeated signal spam.
 * 3. Strict typing: 0 `any` / 0 `any[]`.
 */

import type { 
  Prospect, 
  LeadSignal, 
  AccountMonitoringConfig 
} from '../types';
import { TechnographicsCategorizer } from '../scraper/TechnographicsCategorizer';

export class ContinuousSignalMonitorService {
  /**
   * Generates a deterministic deduplication ID for a signal.
   */
  public static generateSignalId(prospectId: string, signalType: string, detailToken: string): string {
    const raw = `${prospectId}_${signalType}_${detailToken.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return `sig_${raw.slice(0, 48)}`;
  }

  /**
   * Compares two snapshots of a prospect and returns newly detected signals.
   */
  public static detectDeltas(
    previousProspect: Prospect,
    currentProspect: Prospect
  ): LeadSignal[] {
    const signals: LeadSignal[] = [];
    const now = new Date().toISOString();
    const workspaceId = currentProspect.workspaceId;
    const prospectId = currentProspect.id;
    const prospectName = currentProspect.name;
    const prospectDomain = currentProspect.domain;

    const prevTech = TechnographicsCategorizer.categorize(previousProspect.websiteScan?.technologies || []);
    const currTech = TechnographicsCategorizer.categorize(currentProspect.websiteScan?.technologies || []);

    // 1. PAYMENT GATEWAY DELTA & GAP DETECTION (UI Spec Section 31 & 32)
    if (prevTech.payments.length > 0 && currTech.payments.length === 0) {
      signals.push({
        id: this.generateSignalId(prospectId, 'payment_gateway_removed', prevTech.payments.join('_')),
        workspaceId,
        prospectId,
        prospectName,
        prospectDomain,
        type: 'payment_gateway_removed',
        category: 'intent',
        title: 'Payment Gateway Removed',
        headline: '🔥 High Intent: Payment Gateway Removed',
        description: `Website payment gateway (${prevTech.payments.join(', ')}) was removed from ${prospectDomain}.`,
        strength: 'critical',
        confidence: 94,
        scoreImpact: 25,
        previousValue: prevTech.payments.join(', '),
        currentValue: 'No payment gateway detected',
        potentialImplication: 'The institution may be dissatisfied with their previous provider or actively evaluating new fee collection gateways.',
        recommendedAction: 'Contact the Bursar or Principal immediately with the SmartSapp Automated Fee Collection demo.',
        detectedAt: now,
        source: 'Technographic Delta Scanner',
        isRead: false,
        isDismissed: false
      });
    } else if (!prevTech.paymentGapDetected && currTech.paymentGapDetected) {
      signals.push({
        id: this.generateSignalId(prospectId, 'payment_gap_detected', 'admissions_no_payment'),
        workspaceId,
        prospectId,
        prospectName,
        prospectDomain,
        type: 'payment_gap_detected',
        category: 'intent',
        title: 'Payment Gap Detected',
        headline: '🔥 High Intent: Fee Collection Gap Identified',
        description: `Admissions/fee content detected on ${prospectDomain} without an integrated payment gateway.`,
        strength: 'critical',
        confidence: 91,
        scoreImpact: 25,
        previousValue: 'Standard website content',
        currentValue: 'Admissions/fee flow active without gateway',
        potentialImplication: 'Institution is manually handling payments via bank deposits and queues, causing administrative bottleneck.',
        recommendedAction: 'Send automated WhatsApp fee collection pitch to leadership.',
        detectedAt: now,
        source: 'Technographic Delta Scanner',
        isRead: false,
        isDismissed: false
      });
    }

    // 2. SUBDOMAIN / DIGITAL PORTAL DEPLOYMENT DELTA
    const extractPortals = (techs: string[], explicitPortals: typeof currTech.portals) => {
      const list: { subdomain: string; fullUrl: string; type: string }[] = explicitPortals.map(p => ({
        subdomain: p.subdomain,
        fullUrl: p.fullUrl,
        type: p.portalType || 'portal'
      }));

      const PORTAL_PREFIXES = ['moodle', 'portal', 'admissions', 'sis', 'elearning', 'apply', 'student', 'parent', 'fees'];
      for (const t of techs) {
        const lower = t.toLowerCase();
        for (const pfx of PORTAL_PREFIXES) {
          if (lower.includes(pfx) && !list.some(item => item.subdomain === pfx)) {
            list.push({
              subdomain: pfx,
              fullUrl: t.startsWith('http') ? t : `https://${t}`,
              type: pfx === 'moodle' ? 'lms_moodle' : 'portal'
            });
            break;
          }
        }
      }
      return list;
    };

    const prevPortalList = extractPortals(previousProspect.websiteScan?.technologies || [], prevTech.portals);
    const currPortalList = extractPortals(currentProspect.websiteScan?.technologies || [], currTech.portals);

    const prevSubdomains = new Set(prevPortalList.map(p => p.subdomain));
    for (const currPortal of currPortalList) {
      if (!prevSubdomains.has(currPortal.subdomain)) {
        signals.push({
          id: this.generateSignalId(prospectId, 'subdomain_portal_detected', currPortal.subdomain),
          workspaceId,
          prospectId,
          prospectName,
          prospectDomain,
          type: 'subdomain_portal_detected',
          category: 'technographic',
          title: 'New Subdomain Portal Deployed',
          headline: `↑ Technology Change: ${currPortal.subdomain}.${prospectDomain} Detected`,
          description: `A new digital portal (${currPortal.type}) was identified at ${currPortal.fullUrl}.`,
          strength: 'high',
          confidence: 96,
          scoreImpact: 15,
          previousValue: 'No portal on subdomain',
          currentValue: currPortal.fullUrl,
          potentialImplication: 'Institution is expanding digital services for students and parents.',
          recommendedAction: 'Propose SmartSapp Portal Integration to bridge portal announcements to WhatsApp.',
          detectedAt: now,
          source: 'Subdomain Prober Service',
          isRead: false,
          isDismissed: false
        });
      }
    }

    // 3. DECISION MAKER / LEADERSHIP ADDITION
    const prevEmails = new Set(previousProspect.contacts?.map(c => c.email.toLowerCase()) || []);
    for (const contact of currentProspect.contacts || []) {
      if (!prevEmails.has(contact.email.toLowerCase())) {
        signals.push({
          id: this.generateSignalId(prospectId, 'new_decision_maker', contact.email),
          workspaceId,
          prospectId,
          prospectName,
          prospectDomain,
          type: 'new_decision_maker',
          category: 'leadership',
          title: 'New Decision Maker Identified',
          headline: `👤 Leadership: ${contact.name} (${contact.role || 'Leader'}) Added`,
          description: `Identified new key decision maker ${contact.name} (${contact.role || 'Executive'}) with contact email ${contact.email}.`,
          strength: 'high',
          confidence: contact.verificationStatus === 'verified' ? 95 : 80,
          scoreImpact: 15,
          previousValue: 'Contact not previously listed',
          currentValue: `${contact.name} (${contact.role || 'Executive'})`,
          potentialImplication: 'Direct outreach channel unlocked to authorized administrative buyer.',
          recommendedAction: 'Review AI Research Brief and execute personalized multi-channel outreach playbook.',
          detectedAt: now,
          source: 'Decision Maker Resolver & Verifier',
          isRead: false,
          isDismissed: false
        });
      }
    }

    // 4. SSL CERTIFICATE / COMPLIANCE DELTA
    if (previousProspect.websiteScan?.sslValid && currentProspect.websiteScan && !currentProspect.websiteScan.sslValid) {
      signals.push({
        id: this.generateSignalId(prospectId, 'ssl_expiring', 'ssl_invalid'),
        workspaceId,
        prospectId,
        prospectName,
        prospectDomain,
        type: 'ssl_expiring',
        category: 'compliance',
        title: 'SSL Security Vulnerability Detected',
        headline: '⚠️ Compliance Alert: SSL Certificate Expired or Invalid',
        description: `SSL encryption failed or expired on ${prospectDomain}, displaying browser security warnings to visitors.`,
        strength: 'medium',
        confidence: 99,
        scoreImpact: 10,
        previousValue: 'Valid SSL Certificate',
        currentValue: 'Invalid or Expired SSL',
        potentialImplication: 'Parents and visitors encounter browser warning screens, degrading institutional trust.',
        recommendedAction: 'Reach out offering modern secure infrastructure and hosting consultation.',
        detectedAt: now,
        source: 'Website Health Scanner',
        isRead: false,
        isDismissed: false
      });
    }

    // 5. CMS / INFRASTRUCTURE SHIFT
    const prevCms = prevTech.cms.join(', ');
    const currCms = currTech.cms.join(', ');
    if (prevCms && currCms && prevCms !== currCms) {
      signals.push({
        id: this.generateSignalId(prospectId, 'cms_changed', currCms),
        workspaceId,
        prospectId,
        prospectName,
        prospectDomain,
        type: 'cms_changed',
        category: 'technographic',
        title: 'Website Redesign / CMS Shift',
        headline: `↑ Technology Change: CMS Shift to ${currCms}`,
        description: `Content management framework updated from ${prevCms} to ${currCms}.`,
        strength: 'medium',
        confidence: 90,
        scoreImpact: 10,
        previousValue: prevCms,
        currentValue: currCms,
        potentialImplication: 'Institution is actively investing in web modernization and digital initiatives.',
        recommendedAction: 'Engage web development stakeholders with compatible SmartSapp API widgets.',
        detectedAt: now,
        source: 'BuiltWith & DOM Categorizer',
        isRead: false,
        isDismissed: false
      });
    }

    return signals;
  }

  /**
   * Initializes default monitoring preferences for a prospect.
   */
  public static getDefaultMonitoringConfig(prospectId: string, workspaceId: string): AccountMonitoringConfig {
    return {
      prospectId,
      workspaceId,
      status: 'healthy',
      frequency: 'daily',
      monitorWebsite: true,
      monitorTechnology: true,
      monitorDecisionMakers: true,
      monitorBusinessChanges: true,
      notifyInApp: true,
      notifyEmail: true,
      notifyWhatsApp: false,
      changesDetectedCount: 0,
      activeAlertsCount: 0,
      updatedAt: new Date().toISOString()
    };
  }
}
