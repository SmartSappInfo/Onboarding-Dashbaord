export function getBaseUrl(): string {
  // If we are in the browser, use the current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Priority 1: Explicitly set Next.js public URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Priority 2: Vercel system environment variables (Production / Preview)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback based on environment
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const fallback = isDev ? 'http://localhost:9002' : 'https://go.smartsapp.com';

  if (!isDev) {
    console.warn(`[WARNING] NEXT_PUBLIC_APP_URL is missing. Falling back to default: ${fallback}`);
  }

  return fallback;
}

/**
 * Asynchronous function for Server Components, API routes, and Server Actions.
 * Dynamically resolves the current request's domain/host (supporting client custom domains).
 */
export async function getRequestBaseUrl(): Promise<string> {
  // If browser, fallback to getBaseUrl()
  if (typeof window !== 'undefined') {
    return getBaseUrl();
  }

  try {
    // Dynamic import to prevent next/headers from being bundled in client bundles
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const proto = headersList.get('x-forwarded-proto') || 'https';
    
    if (host) {
      return `${proto}://${host}`;
    }
  } catch (error) {
    // In background tasks where request context doesn't exist, headers() throws an error.
    // We fall back gracefully to the standard base URL.
  }

  return getBaseUrl();
}


export function ensureAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';

  // If it's already an absolute URL, return as is
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const baseUrl = getBaseUrl();
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  return `${baseUrl}${cleanPath}`;
}
