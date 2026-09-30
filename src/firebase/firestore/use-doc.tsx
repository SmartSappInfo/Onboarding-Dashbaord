'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
/** Maximum retry attempts for transient Firestore network / deadline exceeded errors. */
const MAX_TRANSIENT_RETRIES = 3;

/** Initial exponential backoff delay in milliseconds. */
const INITIAL_BACKOFF_MS = 1000;

function isTransientFirestoreError(code: string | undefined): boolean {
  return code === 'deadline-exceeded' || code === 'unavailable';
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const auth = useAuth();
  const [data, setData] = useState<StateDataType>(null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  // The ref whose snapshot (or error) produced the current data. Loading is
  // DERIVED as "the current ref hasn't settled yet" — a state-based isLoading
  // flipped inside the effect leaves a one-commit gap where it reads `false`
  // for a brand-new ref, causing consumers (e.g. auth gates) to briefly treat
  // "not fetched yet" as "fetched and empty" (Access Denied flashes).
  const [settledRef, setSettledRef] = useState<DocumentReference<DocumentData> | null>(null);

  const isLoading = !!memoizedDocRef && memoizedDocRef !== settledRef;

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setSettledRef(null);
      return;
    }

    let isSubscribed = true;
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryAttempt = 0;
    const path = memoizedDocRef.path;

    const subscribe = () => {
      if (!isSubscribed) return;

      unsubscribe = onSnapshot(
        memoizedDocRef,
        (snapshot: DocumentSnapshot<DocumentData>) => {
          if (!isSubscribed) return;
          if (snapshot.exists()) {
            setData({ ...(snapshot.data() as T), id: snapshot.id });
          } else {
            // Document does not exist
            setData(null);
          }
          setError(null); // Clear any previous error on successful snapshot (even if doc doesn't exist)
          setSettledRef(memoizedDocRef);
          retryAttempt = 0;
        },
        (_error: FirestoreError) => {
          if (!isSubscribed) return;

          const isTransient = isTransientFirestoreError(_error.code);

          if (isTransient && retryAttempt < MAX_TRANSIENT_RETRIES) {
            const delayMs = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, retryAttempt), 8000);
            retryAttempt += 1;
            console.warn(
              `[Firestore useDoc] Transient error (${_error.code}) on path "${path}". Reconnecting in ${delayMs}ms (attempt ${retryAttempt}/${MAX_TRANSIENT_RETRIES})...`
            );

            retryTimeout = setTimeout(() => {
              if (isSubscribed) {
                subscribe();
              }
            }, delayMs);
            return;
          }

          console.error(
            `[Firestore useDoc Error] (${_error.code || 'unknown'}) on path "${path}":`,
            _error.message || _error
          );

          if (_error.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
              operation: 'get',
              path: memoizedDocRef.path,
            });

            setError(contextualError);

            // trigger global error propagation only if authenticated
            if (auth.currentUser) {
              errorEmitter.emit('permission-error', contextualError);
            }
          } else {
            setError(_error);
          }

          setData(null);
          setSettledRef(memoizedDocRef);
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
  }, [memoizedDocRef]); // Re-run if the memoizedDocRef changes.

  return { data, isLoading, error };
}