'use server';

const PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc';

/**
 * Dispatches signup data to the Pabbly webhook from the server side.
 * This avoids CORS issues that occur when calling external webhooks from the browser.
 */
export async function dispatchSignupWebhook(webhookData: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  console.log('>>> [WEBHOOK] Dispatching signup data to Pabbly...');
  console.log('>>> [WEBHOOK] URL:', PABBLY_WEBHOOK_URL);
  
  try {
    const response = await fetch(PABBLY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`>>> [WEBHOOK] Pabbly returned ${response.status}: ${response.statusText}`);
      console.error(`>>> [WEBHOOK] Error Body:`, errorText);
      return { success: false, error: `Webhook returned ${response.status}: ${response.statusText}` };
    }

    console.log('>>> [WEBHOOK] Successfully dispatched to Pabbly');
    return { success: true };
  } catch (error: any) {
    console.error('>>> [WEBHOOK] Failed to dispatch:', error.message);
    return { success: false, error: error.message };
  }
}
