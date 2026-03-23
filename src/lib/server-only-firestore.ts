
import { adminDb, adminStorage } from './firebase-admin';

/**
 * Server-only utility to get Firebase Admin services.
 * This replaces the broken Web SDK usage on the server.
 */

export function getDb() {
  return adminDb;
}

export function getServerStorage() {
  return adminStorage;
}
