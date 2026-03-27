import '@testing-library/jest-dom';

// Configure Firebase Admin to use emulator for tests
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}
