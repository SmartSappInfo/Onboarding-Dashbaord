import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, headers, payload } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'Missing webhook URL' }, { status: 400 });
    }
    
    let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (headers) {
      try {
        parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) };
      } catch (e) {
        // If it's not valid JSON, try parsing as key-value pairs (Header: Value) separated by newlines
        const lines = headers.split('\n');
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > -1) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            if (key) {
              parsedHeaders[key] = val;
            }
          }
        }
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: parsedHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      let responseBody = '';
      try {
        responseBody = await res.text();
      } catch (e) {
        // ignore parsing error if response is empty or binary
      }
      
      return NextResponse.json({ 
        status: res.status, 
        ok: res.ok,
        body: responseBody
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Webhook request timed out (10s limit)' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (err: any) {
    console.error('[WEBHOOK_PROXY_ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
