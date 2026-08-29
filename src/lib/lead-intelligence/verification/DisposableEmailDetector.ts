/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 5):
 * 
 * DisposableEmailDetector identifies throwaway, temporary, and spam-trap domains
 * using high-speed O(1) hash lookup to prevent outbound campaign reputation damage.
 * 
 * Invariants & Safeguards:
 * 1. Constant Time: Hoisted static Set ensures instantaneous evaluation.
 * 2. Strict Typing: Zero `any` or `any[]`.
 */

export class DisposableEmailDetector {
  private static readonly DISPOSABLE_DOMAINS = new Set([
    'mailinator.com',
    'tempmail.com',
    'temp-mail.org',
    'guerrillamail.com',
    'guerrillamailblock.com',
    '10minutemail.com',
    '10minutemail.net',
    'yopmail.com',
    'throwawaymail.com',
    'fakeinbox.com',
    'sharklasers.com',
    'dispostable.com',
    'getairmail.com',
    'crazymailing.com',
    'trashmail.com',
    'trashmail.net',
    'mailcatch.com',
    'maildrop.cc',
    'mailnesia.com',
    'mytrashmail.com',
    'nada.ltd',
    'getnada.com',
    'tempr.email',
    'discard.email',
    'mohmal.com',
    'burnermail.io',
    'inboxkitten.com',
    'emailondeck.com',
    'generator.email',
    'dropmail.me',
    'tempail.com',
    'internxt.com',
    'minuteinbox.com',
    'fakemailgenerator.com',
    'dayrep.com',
    'teleworm.us',
    'armyspy.com',
    'cuvox.de',
    'fleckens.hu',
    'gustr.com',
    'jourrapide.com',
    'rhyta.com',
    'superrito.com'
  ]);

  /**
   * Checks if a domain is a known disposable or temporary email provider.
   */
  public static isDisposable(domain: string): boolean {
    if (!domain) return false;
    const clean = domain.trim().toLowerCase();
    return this.DISPOSABLE_DOMAINS.has(clean);
  }
}
