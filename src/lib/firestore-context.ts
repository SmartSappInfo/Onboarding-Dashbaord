/**
 * @fileOverview Firestore Context Adapter
 * Re-exports `useFirestore`, `useFirebase`, and client Firebase hooks from `@/firebase`.
 * Provides seamless resolution for media, deals, and backoffice components importing from `@/lib/firestore-context`.
 */

'use client';

export { useFirestore, useFirebase, useUser, useAuth, useFirebaseApp, useMemoFirebase } from '@/firebase';
