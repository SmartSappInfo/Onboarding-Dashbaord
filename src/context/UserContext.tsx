'use client';

/**
 * @fileoverview User Context Adapter
 * 
 * Re-exports `useUser` from `@/firebase` to ensure seamless compatibility across
 * components and dashboard widgets requiring the authenticated user context.
 */

export { useUser } from '@/firebase';
