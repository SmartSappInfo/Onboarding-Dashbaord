/**
 * {{Org_name}} Experience Platform — Canonical Portal Navigation & Route Resolver
 *
 * Provides pure, deterministic, client-safe URL resolution for Experience Portals.
 * Intelligently maps root preset paths (e.g. '/courses', '/resources', '/get-started')
 * to their canonical portal-scoped runtime routes, while strictly preserving external URLs,
 * mailto/tel protocols, and anchor links.
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Pure & Client-Safe: Zero Node or Firebase Admin imports; safe for RSC and client components.
 * - Conforms to next-best-practices, vercel-react-best-practices, and security sanitization.
 *
 * Future Maintainers Note:
 * - When adding new experience spaces or sub-routes to portals, register them in CANONICAL_SPACE_ROUTES
 *   and update the alias switch cases below.
 * - Always maintain one-way canonical resolution to prevent circular redirect loops.
 */

export interface CanonicalSpaceRouteMap {
  home: string;
  learn: string;
  content: string;
  community: string;
  events: string;
  join: string;
  dashboard: string;
  affiliates: string;
  docs: string;
  articles: string;
}

export interface PortalCanonicalDestination {
  id: string;
  label: string;
  subpath: string;
  description: string;
  iconName: string;
}

/**
 * Standard registry of pre-defined canonical destinations available for Experience Portals.
 * Used by PortalNavigationBuilder in Backoffice Studio to ensure admins link directly to canonical paths.
 */
export const PORTAL_CANONICAL_DESTINATIONS: readonly PortalCanonicalDestination[] = [
  {
    id: 'learn',
    label: 'Course Curriculum / Learning',
    subpath: '/learn',
    description: 'Catalog of courses, masterclasses, lessons, and modules',
    iconName: 'GraduationCap',
  },
  {
    id: 'content',
    label: 'Resource Vault (All)',
    subpath: '/content',
    description: 'Searchable library of resources, docs, articles, and templates',
    iconName: 'FolderArchive',
  },
  {
    id: 'docs',
    label: 'Help Centre & Documentation',
    subpath: '/content?type=doc',
    description: 'Technical documentation, SOPs, FAQs, and product manuals',
    iconName: 'FileCode',
  },
  {
    id: 'articles',
    label: 'Articles & Insights',
    subpath: '/content?type=article',
    description: 'Long-form editorial articles, news, and knowledge base pieces',
    iconName: 'Newspaper',
  },
  {
    id: 'resources',
    label: 'Downloads & Toolkits',
    subpath: '/content?type=resource',
    description: 'Downloadable templates, spreadsheets, and file assets',
    iconName: 'Download',
  },
  {
    id: 'community',
    label: 'Member Community',
    subpath: '/community',
    description: 'Interactive social discussions, spaces, and member networking',
    iconName: 'Users',
  },
  {
    id: 'events',
    label: 'Live Events & Workshops',
    subpath: '/events',
    description: 'Webinars, cohort calls, and live streaming sessions',
    iconName: 'Calendar',
  },
  {
    id: 'join',
    label: 'Get Started / Join Portal',
    subpath: '/join',
    description: 'Direct member registration, enrollment and sign-in page',
    iconName: 'UserPlus',
  },
  {
    id: 'dashboard',
    label: 'Member Dashboard',
    subpath: '/dashboard',
    description: 'Personal learner dashboard, enrolled courses and badges',
    iconName: 'LayoutDashboard',
  },
  {
    id: 'home',
    label: 'Portal Home / Landing Page',
    subpath: '/',
    description: 'Main experience landing page and hero overview',
    iconName: 'Home',
  },
] as const;

/**
 * Normalizes a relative nav path (e.g. '/courses', '/resources', '/get-started')
 * to its canonical equivalent (e.g. '/learn', '/content', '/join').
 * Preserves external URLs, anchors, and unrecognized custom relative paths.
 */
export function normalizePortalRelativePath(rawPath: string | undefined | null): string {
  if (!rawPath || !rawPath.trim() || rawPath.trim() === '#') {
    return '/';
  }
  const trimmed = rawPath.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return '/';
  }

  let normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const [pathSegment, ...querySegments] = normalized.split('?');
  const queryPart = querySegments.length > 0 ? `?${querySegments.join('?')}` : '';
  const [basePath, ...hashSegments] = pathSegment.split('#');
  const hashPart = hashSegments.length > 0 ? `#${hashSegments.join('#')}` : '';
  const cleanBase = basePath.toLowerCase().trim();

  switch (cleanBase) {
    case '':
    case 'home':
    case 'index':
      return `/${queryPart}${hashPart}`;

    case 'courses':
    case 'course':
    case 'learn':
    case 'curriculum':
    case 'classes':
    case 'masterclass':
    case 'modules':
    case 'training':
    case 'roadmap':
    case 'assignments':
      return `/learn${queryPart}${hashPart}`;

    case 'resources':
    case 'resource':
    case 'vault':
    case 'content':
    case 'downloads':
    case 'templates':
    case 'assets':
    case 'library':
      return `/content${queryPart}${hashPart}`;

    case 'docs':
    case 'doc':
    case 'documentation':
    case 'help':
    case 'faq':
    case 'faqs':
    case 'support':
    case 'knowledge-base':
    case 'sop':
    case 'sops':
      return `/content?type=doc${hashPart}`;

    case 'articles':
    case 'article':
    case 'blog':
    case 'news':
    case 'topics':
    case 'insights':
      return `/content?type=article${hashPart}`;

    case 'community':
    case 'feed':
    case 'forum':
    case 'discussions':
    case 'members':
    case 'leaderboard':
      return `/community${queryPart}${hashPart}`;

    case 'events':
    case 'event':
    case 'live':
    case 'webinars':
    case 'webinar':
    case 'workshops':
    case 'cohorts':
    case 'calls':
      return `/events${queryPart}${hashPart}`;

    case 'get-started':
    case 'getting-started':
    case 'join':
    case 'signup':
    case 'register':
    case 'enroll':
      return `/join${queryPart}${hashPart}`;

    case 'dashboard':
    case 'hub':
    case 'my-learning':
    case 'my-courses':
    case 'progress':
    case 'account':
      return `/dashboard${queryPart}${hashPart}`;

    case 'affiliates':
    case 'affiliate':
    case 'partner':
    case 'referrals':
      return `/affiliates${queryPart}${hashPart}`;

    default:
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}

/**
 * Returns a strongly-typed dictionary of canonical destination paths for a given portal slug.
 */
export function getPortalSpaceLinks(portalSlug: string): CanonicalSpaceRouteMap {
  const cleanSlug = encodeURIComponent(portalSlug.trim());
  return {
    home: `/portal/${cleanSlug}`,
    learn: `/portal/${cleanSlug}/learn`,
    content: `/portal/${cleanSlug}/content`,
    community: `/portal/${cleanSlug}/community`,
    events: `/portal/${cleanSlug}/events`,
    join: `/portal/${cleanSlug}/join`,
    dashboard: `/portal/${cleanSlug}/dashboard`,
    affiliates: `/portal/${cleanSlug}/affiliates`,
    docs: `/portal/${cleanSlug}/content?type=doc`,
    articles: `/portal/${cleanSlug}/content?type=article`,
  };
}

/**
 * Resolves any raw, relative, preset, or legacy navigation path into a canonical,
 * portal-scoped runtime URL.
 *
 * Examples:
 * - '/courses' -> '/portal/academy/learn'
 * - '/resources' -> '/portal/academy/content'
 * - '/community' -> '/portal/academy/community'
 * - '/get-started' -> '/portal/academy/join'
 * - '/portal/academy/courses' -> '/portal/academy/learn'
 * - 'https://smartsapp.com' -> 'https://smartsapp.com' (untouched)
 * - '#curriculum' -> '#curriculum' (untouched)
 *
 * Security:
 * - Rejects protocol-relative open redirect attacks (e.g. '//evil.com').
 *
 * @param rawPath The path configured on the nav item or button.
 * @param portalSlug The active portal's slug identifier.
 * @returns The resolved canonical URL string.
 */
export function resolvePortalPath(
  rawPath: string | undefined | null,
  portalSlug: string
): string {
  const cleanSlug = portalSlug.trim();
  if (!cleanSlug) {
    return '/';
  }

  // Fallback to portal home if path is empty, root slash, or placeholder hash
  if (!rawPath || rawPath.trim() === '' || rawPath.trim() === '#') {
    return `/portal/${cleanSlug}`;
  }

  const trimmed = rawPath.trim();

  // 1. Preserve external URLs and standard protocols untouched
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return trimmed;
  }

  // 2. Preserve in-page hash anchors untouched
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  // 3. Security: Prevent protocol-relative URLs (e.g. //attacker.com)
  if (trimmed.startsWith('//')) {
    return `/portal/${cleanSlug}`;
  }

  // 4. Strip leading slash for consistent normalization
  let normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  // 5. If path is already scoped with 'portal/[slug]' or '/portal/[slug]', strip prefix to extract subpath
  const portalPrefix = `portal/${cleanSlug}`;
  if (normalized.startsWith(portalPrefix)) {
    normalized = normalized.slice(portalPrefix.length);
    if (normalized.startsWith('/')) {
      normalized = normalized.slice(1);
    }
  }

  // Separate path from query parameters or hash fragments
  const [pathSegment, ...querySegments] = normalized.split('?');
  const queryPart = querySegments.length > 0 ? `?${querySegments.join('?')}` : '';

  const [basePath, ...hashSegments] = pathSegment.split('#');
  const hashPart = hashSegments.length > 0 ? `#${hashSegments.join('#')}` : '';

  const cleanBase = basePath.toLowerCase().trim();

  // 6. Canonical Mapping for Known Route Tokens & Mode Presets
  switch (cleanBase) {
    case '':
    case 'home':
    case 'index':
      return `/portal/${cleanSlug}${queryPart}${hashPart}`;

    // Learning / Courses / Curriculum / Masterclasses
    case 'courses':
    case 'course':
    case 'learn':
    case 'curriculum':
    case 'classes':
    case 'masterclass':
    case 'modules':
    case 'training':
    case 'roadmap':
    case 'assignments':
      return `/portal/${cleanSlug}/learn${queryPart}${hashPart}`;

    // Content Vault / Resources / Downloads / Templates / Library
    case 'resources':
    case 'resource':
    case 'vault':
    case 'content':
    case 'downloads':
    case 'templates':
    case 'assets':
    case 'library':
      return `/portal/${cleanSlug}/content${queryPart}${hashPart}`;

    // Documentation / Help Centre / FAQs
    case 'docs':
    case 'doc':
    case 'documentation':
    case 'help':
    case 'faq':
    case 'faqs':
    case 'support':
    case 'knowledge-base':
    case 'sop':
    case 'sops':
      return `/portal/${cleanSlug}/content?type=doc${hashPart}`;

    // Articles / Insights / Blog / Publications
    case 'articles':
    case 'article':
    case 'blog':
    case 'news':
    case 'topics':
    case 'insights':
      return `/portal/${cleanSlug}/content?type=article${hashPart}`;

    // Community / Feed / Discussions / Members
    case 'community':
    case 'feed':
    case 'forum':
    case 'discussions':
    case 'members':
    case 'leaderboard':
      return `/portal/${cleanSlug}/community${queryPart}${hashPart}`;

    // Live Events / Webinars / Workshops / Cohorts
    case 'events':
    case 'event':
    case 'live':
    case 'webinars':
    case 'webinar':
    case 'workshops':
    case 'cohorts':
    case 'calls':
      return `/portal/${cleanSlug}/events${queryPart}${hashPart}`;

    // Onboarding / Registration / Join / Get Started
    case 'get-started':
    case 'getting-started':
    case 'join':
    case 'signup':
    case 'register':
    case 'enroll':
      return `/portal/${cleanSlug}/join${queryPart}${hashPart}`;

    // Member Hub / Learning Dashboard / Progress
    case 'dashboard':
    case 'hub':
    case 'my-learning':
    case 'my-courses':
    case 'progress':
    case 'account':
      return `/portal/${cleanSlug}/dashboard${queryPart}${hashPart}`;

    // Affiliates / Partner Portal
    case 'affiliates':
    case 'affiliate':
    case 'partner':
    case 'referrals':
      return `/portal/${cleanSlug}/affiliates${queryPart}${hashPart}`;

    default: {
      // 7. Check if basePath has a known sub-route prefix (e.g. 'learn/xyz' or 'courses/xyz')
      if (cleanBase.startsWith('courses/')) {
        const courseSubpath = basePath.slice('courses/'.length);
        return `/portal/${cleanSlug}/learn/${courseSubpath}${queryPart}${hashPart}`;
      }

      if (
        cleanBase.startsWith('learn/') ||
        cleanBase.startsWith('community/') ||
        cleanBase.startsWith('content/') ||
        cleanBase.startsWith('events/') ||
        cleanBase.startsWith('checkout/') ||
        cleanBase.startsWith('verify/') ||
        cleanBase.startsWith('dashboard/') ||
        cleanBase.startsWith('affiliates/')
      ) {
        return `/portal/${cleanSlug}/${basePath}${queryPart}${hashPart}`;
      }

      // Default safe fallback: append sanitized path under portal slug
      return `/portal/${cleanSlug}/${basePath}${queryPart}${hashPart}`;
    }
  }
}
