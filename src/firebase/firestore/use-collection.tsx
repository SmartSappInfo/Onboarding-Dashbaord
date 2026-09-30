'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
/** Maximum retry attempts for transient Firestore network / deadline exceeded errors. */
const MAX_TRANSIENT_RETRIES = 3;

/** Initial exponential backoff delay in milliseconds. */
const INITIAL_BACKOFF_MS = 1000;

function isTransientFirestoreError(code: string | undefined): boolean {
  return code === 'deadline-exceeded' || code === 'unavailable';
}

function extractTargetQueryPath(
  target: (CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean }
): string {
  try {
    if (target.type === 'collection') {
      return (target as CollectionReference).path;
    }
    const internal = target as unknown as InternalQuery;
    return (
      internal._query?.path?.canonicalString?.() ??
      internal._query?.path?.toString?.() ??
      'query'
    );
  } catch {
    return 'query';
  }
}

export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const auth = useAuth();
  const [data, setData] = useState<StateDataType>(null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  // The query whose snapshot (or error) produced the current data. Loading is
  // DERIVED as "the current query hasn't settled yet" — a state-based
  // isLoading flipped inside the effect leaves a one-commit gap where it reads
  // `false` for a brand-new query, causing consumers to briefly treat
  // "not fetched yet" as "fetched and empty" (empty-state flashes, gate races).
  // Identity comparison is safe: the memoization contract is enforced below.
  const [settledQuery, setSettledQuery] = useState<Query<DocumentData> | null>(null);

  const isLoading = !!memoizedTargetRefOrQuery && memoizedTargetRefOrQuery !== settledQuery;

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setError(null);
      setSettledQuery(null);
      return;
    }

    let isSubscribed = true;
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryAttempt = 0;

    const path = extractTargetQueryPath(memoizedTargetRefOrQuery);

    const subscribe = () => {
      if (!isSubscribed) return;

      unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          if (!isSubscribed) return;
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          setData(results);
          setError(null);
          setSettledQuery(memoizedTargetRefOrQuery);
          retryAttempt = 0; // Reset retry counter on successful snapshot delivery
        },
        (_error: FirestoreError) => {
          if (!isSubscribed) return;

          const isTransient = isTransientFirestoreError(_error.code);

          // Handle transient errors (e.g. deadline-exceeded, unavailable) with automatic exponential backoff
          if (isTransient && retryAttempt < MAX_TRANSIENT_RETRIES) {
            const delayMs = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, retryAttempt), 8000);
            retryAttempt += 1;
            console.warn(
              `[Firestore useCollection] Transient error (${_error.code}) on path "${path}". Reconnecting in ${delayMs}ms (attempt ${retryAttempt}/${MAX_TRANSIENT_RETRIES})...`
            );

            // Retain existing data (stale-while-revalidate) during reconnection so the UI doesn't flash empty
            retryTimeout = setTimeout(() => {
              if (isSubscribed) {
                subscribe();
              }
            }, delayMs);
            return;
          }

          // Terminal error or exhausted retry attempts
          console.error(
            `[Firestore useCollection Error] (${_error.code || 'unknown'}) on path "${path}":`,
            _error.message || _error
          );

          if (_error.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
              operation: 'list',
              path,
            });

            setError(contextualError);

            // trigger global error propagation only if authenticated
            if (auth.currentUser) {
              errorEmitter.emit('permission-error', contextualError);
            }
          } else {
            // For indexing errors (failed-precondition) or terminal network issues, retain original error without false security rule banner
            setError(_error);
          }

          setData(null);
          setSettledQuery(memoizedTargetRefOrQuery);
        }
      );
    };

    subscribe();

    return () => {
      isSubscribed = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth is read only for contextual error reporting and must not trigger subscription restarts
  }, [memoizedTargetRefOrQuery]); // Re-run if the target query/reference changes.

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}