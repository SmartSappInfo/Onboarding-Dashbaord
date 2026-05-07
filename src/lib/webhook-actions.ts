'use server';

const PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc';

/**
 * Dispatches signup data to the Pabbly webhook from the server side.
 * This avoids CORS issues that occur when calling external webhooks from the browser.
 */
export async function dispatchSignupWebhook(webhookData: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(PABBLY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData),
    });

    if (!response.ok) {
      console.error(`>>> [WEBHOOK] Pabbly returned ${response.status}: ${response.statusText}`);
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('>>> [WEBHOOK] Failed to dispatch:', error.message);
    return { success: false, error: error.message };
  }
}
