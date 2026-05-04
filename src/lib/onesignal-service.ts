export interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: any;
}

export async function sendPushNotification(
  userIds: string[],
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<OneSignalResponse | null> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn('>>> [PUSH] OneSignal credentials missing. Skipping push dispatch.');
    return null;
  }

  if (!userIds.length) return null;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: userIds,
        headings: { en: title },
        contents: { en: message },
        data: data,
        // By default, OneSignal will queue these
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('>>> [PUSH] OneSignal API Error:', response.status, errorText);
      return { errors: errorText };
    }

    const responseData = await response.json();
    return responseData;
  } catch (error: any) {
    console.error('>>> [PUSH] Failed to dispatch via OneSignal:', error.message);
    return { errors: error.message };
  }
}
