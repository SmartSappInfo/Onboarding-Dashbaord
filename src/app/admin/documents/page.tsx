import DocumentStudioClient from './DocumentStudioClient';
import { Metadata } from 'next';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Document Studio Dashboard Route:
 *    Admin route `/admin/documents` serving the Enterprise Document Experience Platform studio.
 * 2. Next.js 16 App Router Standards:
 *    Dynamic rendering with force-dynamic configuration and zero SSR caching for fresh workspace data.
 * 3. Strict Typing:
 *    Zero `any` or `any[]` types are permitted.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Document Studio | SmartSapp',
  description: 'Manage interactive brochures, prospectuses, magazines, and digital publications.',
};

export default function DocumentStudioPage() {
  return <DocumentStudioClient />;
}
