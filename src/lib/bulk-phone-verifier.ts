import {
  PhoneVerificationEngine,
  VerifyPhoneResult,
} from './phone-verifier';
import { PhoneHygieneRepository } from './phone-hygiene-repository';

export interface BulkPhoneVerificationOptions {
  forceRefresh?: boolean;
}

/** A phone to verify, optionally with the owning org's default country for local-format parsing. */
export interface PhoneVerificationInput {
  phone: string;
  defaultCountry?: string;
}

/**
 * Bulk phone verification service.
 * Mirrors BulkVerificationService (email) without the domain-serialization
 * jitter — verification is offline/CPU-only, so there is nothing to throttle.
 */
export class BulkPhoneVerificationService {
  /**
   * Processes a list of phones with cache-diff checks and batched db writes.
   * Accepts plain strings or { phone, defaultCountry } inputs.
   */
  async processBulk(
    phones: (string | PhoneVerificationInput)[],
    options: BulkPhoneVerificationOptions = {}
  ) {
    // Normalize inputs and dedupe by stored phone string
    const inputs = new Map<string, PhoneVerificationInput>();
    for (const entry of phones) {
      const input = typeof entry === 'string' ? { phone: entry } : entry;
      const key = input.phone?.trim();
      if (key && !inputs.has(key)) {
        inputs.set(key, { ...input, phone: key });
      }
    }

    const allUpdates: [string, VerifyPhoneResult][] = [];

    for (const input of inputs.values()) {
      let needsUpdate = true;
      let finalResult: VerifyPhoneResult | null = null;

      const cached = await this.getHygieneFromCache(input.phone);
      const hasCachedResult = !!cached && typeof cached.score === 'number';

      if (!options.forceRefresh && hasCachedResult) {
        // Valid cache hit, skip verification and write
        needsUpdate = false;
      } else {
        finalResult = await this.executeSingleVerification(input);

        // Diff check: identical score+status needs no costly write — unless a
        // 'verifying' lock is pending, in which case we still write to clear it.
        if (
          hasCachedResult &&
          cached!.score === finalResult.score &&
          cached!.status === finalResult.status &&
          cached!._status !== 'verifying'
        ) {
          needsUpdate = false;
        }
      }

      if (needsUpdate && finalResult) {
        allUpdates.push([input.phone, finalResult]);
      }
    }

    // Commit updates to Firestore in strict batches of 500
    for (let i = 0; i < allUpdates.length; i += 500) {
      const chunk = allUpdates.slice(i, i + 500);
      if (chunk.length > 0) {
        await this.commitBatchToFirestore(chunk);
      }
    }

    return allUpdates;
  }

  private engine: PhoneVerificationEngine;

  constructor() {
    this.engine = new PhoneVerificationEngine();
  }

  // Virtual methods for mocking and injection
  protected async executeSingleVerification(input: PhoneVerificationInput): Promise<VerifyPhoneResult> {
    return this.engine.verify(input.phone, input.defaultCountry);
  }

  protected async getHygieneFromCache(phone: string): Promise<(Partial<VerifyPhoneResult> & { _status?: string }) | null> {
    return PhoneHygieneRepository.getCache(phone);
  }

  protected async commitBatchToFirestore(updates: [string, VerifyPhoneResult][]): Promise<void> {
    return PhoneHygieneRepository.commitBatch(updates);
  }
}
