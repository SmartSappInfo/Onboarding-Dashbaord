# Testing with Firebase Emulator

## Overview

Integration tests that interact with Firestore (like `metrics-actions.test.ts`) require a Firebase connection. To run these tests locally without production credentials, we use the Firebase Emulator.

## Setup

### 1. Install Firebase Tools (if not already installed)

```bash
npm install -g firebase-tools
```

### 2. Start the Firebase Emulator

```bash
firebase emulators:start --only firestore
```

This will start the Firestore emulator on `localhost:8080`.

### 3. Run Tests with Emulator

Option A: Run tests while emulator is running in another terminal:
```bash
npm test
```

Option B: Auto-start emulator and run tests:
```bash
npm run test:emulator
```

## Configuration

The test setup (`src/test/setup.ts`) automatically configures Firebase Admin SDK to use the emulator when running tests by setting:
- `FIRESTORE_EMULATOR_HOST=localhost:8080`
- `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`

## Test Types

### Unit Tests (Mocked)
Tests like `workspace-entity-actions.test.ts` mock Firebase and don't need the emulator.

### Integration Tests (Emulator Required)
Tests like `metrics-actions.test.ts` perform real Firestore queries and require the emulator:
- `metrics-actions.test.ts` - Metrics and reporting
- Other tests that use `adminDb` directly

## Troubleshooting

### Error: "Could not load the default credentials"
This means the test is trying to connect to real Firebase instead of the emulator.

**Solution**: Make sure the emulator is running before running tests.

### Tests timeout after 10 seconds
The default timeout was too short for integration tests.

**Solution**: We've increased `testTimeout` and `hookTimeout` to 30 seconds in `vitest.config.ts`.

### CJS deprecation warning
This was fixed by adding `"type": "module"` to `package.json` and updating path resolution in `vitest.config.ts`.

## CI/CD

For CI environments, use:
```bash
npm run test:emulator
```

This automatically starts the emulator, runs tests, and stops the emulator.
