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

  // Fallback: Default production domain
  return 'https://go.smartsapp.com';
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
