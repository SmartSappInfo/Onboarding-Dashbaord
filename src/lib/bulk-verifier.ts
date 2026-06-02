import { 
  EmailVerificationEngine, 
  SyntaxValidator, 
  DnsValidator, 
  BurnerValidator, 
  SmtpValidator, 
  VerifyEmailResult 
} from './email-verifier';
import { ContactHygieneRepository } from './hygiene-repository';

export interface BulkVerificationOptions {
  forceRefresh?: boolean;
}

export class BulkVerificationService {
  /**
   * Processes a list of emails applying domain-serialization throttling and batched db writes.
   */
  async processBulk(emails: string[], options: BulkVerificationOptions = {}) {
    const domainMap = new Map<string, string[]>();
    const allUpdates: [string, VerifyEmailResult][] = [];

    // 1. Group emails by their domain to enforce serialization rules
    for (const email of emails) {
      const [, domain] = email.split('@');
      if (!domain) {
        // No domain -> syntactically invalid, execute immediately if not already cached
        const cached = await this.getHygieneFromCache(email);
        if (options.forceRefresh || !cached || cached.status !== 'invalid') {
          const finalResult = await this.executeSingleVerification(email);
          allUpdates.push([email, finalResult]);
        }
        continue;
      }
      const lowerDomain = domain.toLowerCase();
      if (!domainMap.has(lowerDomain)) {
        domainMap.set(lowerDomain, []);
      }
      domainMap.get(lowerDomain)!.push(email);
    }

    // 2. Process each domain bucket in parallel, but serialize requests WITHIN the same domain
    const domainPromises = Array.from(domainMap.entries()).map(async ([domain, domainEmails]) => {
      for (const email of domainEmails) {
        let needsUpdate = true;
        let finalResult: VerifyEmailResult | null = null;

        const cached = await this.getHygieneFromCache(email);

        if (!options.forceRefresh && cached) {
          // Valid cache hit, skip probe and write
          needsUpdate = false; 
        } else {
          finalResult = await this.executeSingleVerification(email);
          
          // Diff check: if the newly calculated score is exactly identical to the cached score,
          // we do not need to perform a costly database write operation.
          if (cached && cached.score === finalResult.score && cached.status === finalResult.status) {
             needsUpdate = false;
          }
        }
        
        if (needsUpdate && finalResult) {
            allUpdates.push([email, finalResult]);
        }
        
        // Jitter delay strictly applied between probes to the exact same domain
        // to prevent graylisting. Only delay if there are more emails for this domain.
        if (domainEmails.length > 1) {
            await new Promise(r => setTimeout(r, 300));
        }
      }
    });

    await Promise.all(domainPromises);

    // 3. Commit updates to Firestore in strict batches of 500 (Firestore transaction limit)
    for (let i = 0; i < allUpdates.length; i += 500) {
      const chunk = allUpdates.slice(i, i + 500);
      if (chunk.length > 0) {
        await this.commitBatchToFirestore(chunk);
      }
    }

    return allUpdates;
  }

  private engine: EmailVerificationEngine;

  constructor() {
    this.engine = new EmailVerificationEngine([
      new SyntaxValidator(),
      new BurnerValidator(),
      new DnsValidator(),
      new SmtpValidator()
    ]);
  }

  // Virtual methods for mocking and injection
  protected async executeSingleVerification(email: string): Promise<VerifyEmailResult> {
    return this.engine.verify(email);
  }

  protected async getHygieneFromCache(email: string): Promise<Partial<VerifyEmailResult> | null> {
    return ContactHygieneRepository.getCache(email);
  }

  protected async commitBatchToFirestore(updates: [string, VerifyEmailResult][]): Promise<void> {
    return ContactHygieneRepository.commitBatch(updates);
  }
}
