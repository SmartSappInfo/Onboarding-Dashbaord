import { NextResponse } from 'next/server';
import { 
  EmailVerificationEngine, 
  SyntaxValidator, 
  DnsValidator, 
  BurnerValidator, 
  SmtpValidator 
} from '@/lib/email-verifier';

/**
 * POST /api/verify-email
 * Executes the 4-layer SmartSapp Verify engine.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email string is required.' }, { status: 400 });
    }

    // Initialize our orchestrated Engine with all validation strategies.
    // By injecting these, the engine adheres to OCP (Open-Closed Principle).
    const engine = new EmailVerificationEngine([
      new SyntaxValidator(),
      new BurnerValidator(),
      new DnsValidator(),
      new SmtpValidator()
    ]);

    // The verifier automatically manages aggressive Promise.race timeouts
    // preventing the Next.js serverless functions from exceeding duration limits.
    const result = await engine.verify(email);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Email Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification.', details: error.message },
      { status: 500 }
    );
  }
}
