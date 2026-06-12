import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { Webhook } from 'svix';
import { processUnsubscribe } from '@/lib/services/unsubscribe-service';

/**
 * POST /api/webhooks/email
 *
 * Ingests external email service provider (ESP) webhook events (e.g. Resend, SendGrid)
 * and asynchronously routes bounces, spam reports, and unsubscriptions.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.text();
    
    // Verify Svix signature (used by Resend)
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    
    if (secret) {
      const svixId = req.headers.get('svix-id') || '';
      const svixTimestamp = req.headers.get('svix-timestamp') || '';
      const svixSignature = req.headers.get('svix-signature') || '';
      
      try {
        const wh = new Webhook(secret);
        const event = wh.verify(payload, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as { type: string; data: any };
        
        const type = event.type;
        const data = event.data;
        const toList: string[] = Array.isArray(data?.to) 
          ? data.to 
          : typeof data?.to === 'string' 
            ? [data.to] 
            : [];
        
        if (toList.length > 0 && ['email.bounced', 'email.complained'].includes(type)) {
          const emailStatus = type === 'email.bounced' ? 'bounced' : 'complained';
          
          try {
            // Process asynchronously to avoid blocking the webhook response
            after(async () => {
              try {
                console.log(`[EMAIL-WEBHOOK] Background processing ${type} for ${toList.join(', ')}`);
                for (const recipient of toList) {
                  await processUnsubscribe(recipient, { emailStatus });
                }
              } catch (e: any) {
                console.error(`[EMAIL-WEBHOOK] Async processing failed:`, e.message);
              }
            });
          } catch (err) {
            // Fallback for environment outside request context (e.g. tests)
            console.warn(`[EMAIL-WEBHOOK] next/server after() was called outside Next.js request context. Executing synchronously.`);
            for (const recipient of toList) {
              await processUnsubscribe(recipient, { emailStatus });
            }
          }
        }
      } catch (err: any) {
        console.error('[EMAIL-WEBHOOK] Svix verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // Fallback: If no secret is configured (e.g. local test/dev), process without signature verification
      console.warn('[EMAIL-WEBHOOK] RESEND_WEBHOOK_SECRET is not configured. Processing payload without verification.');
      const parsed = JSON.parse(payload);
      const { type, data } = parsed;
      const toList: string[] = Array.isArray(data?.to) 
        ? data.to 
        : typeof data?.to === 'string' 
          ? [data.to] 
          : [];
      
      if (toList.length > 0 && ['email.bounced', 'email.complained'].includes(type)) {
        const emailStatus = type === 'email.bounced' ? 'bounced' : 'complained';
        for (const recipient of toList) {
          await processUnsubscribe(recipient, { emailStatus });
        }
      }
    }
    
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[EMAIL-WEBHOOK] Error handling webhook:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
