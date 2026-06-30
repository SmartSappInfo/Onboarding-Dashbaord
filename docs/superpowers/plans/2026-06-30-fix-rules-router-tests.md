# Fix Emulator Connection and Component Test Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gracefully skip Firebase Security Rules tests when the Firestore Emulator is not running locally, resolve Next.js Router invariant errors in component tests, and clean up any obsolete test conditions without disrupting application functionality.

**Architecture:** 
- We use top-level `await` and a Node `net` socket connection check at the top of security rules test files to dynamically skip the tests if the local emulator port (`8080`) is not active. This keeps the tests valid and working for local/CI pipelines running emulators, while preventing failures when run without them.
- We mock `next/navigation` in tests rendering routing-dependent client components (e.g. `TemplateCard` or `TemplateGallery`).

**Tech Stack:** TypeScript, Vitest, Node.js sockets.

---

## What Could Go Wrong & Resolutions

1. **Socket Connection Hang or Resource Leak:** If socket connections are opened but not properly closed or timed out, tests can hang indefinitely or leak system file descriptors.
   - *Resolution:* Set an explicit timeout (1000ms) on the socket connection, and ensure `socket.destroy()` is called in all success, error, and timeout event pathways.
2. **Top-Level `await` Support in Environment:** If Vitest is executed in a non-Node browser sandbox environment, the Node `net` module will be unavailable.
   - *Resolution:* The security rules tests themselves already use Node-specific APIs like `fs.readFileSync` and run strictly in the default Node/JSDOM context where the `net` module is fully accessible.
3. **Typing Restrictions (`any` or `any[]`):** Introducing generic error handlers or untyped callback parameters violates strict typings.
   - *Resolution:* The helper uses a strongly-typed signature `Promise<boolean>` and has zero references to `any`.

---

## Affected Features & Mitigation

- **Security Rules Tests:** No actual Firebase security rules or testing assertions are modified. The tests will run and validate rules when the emulator is started (e.g. on CI or local dev runs using the `test:emulator` script), but will gracefully skip without causing build pipeline breaks when executed standalone.
- **Other Components:** No main production application files are touched.

---

### Task 1: Check and Gracefully Skip Rules Tests when Emulator is Offline

We will add a socket connection check to check if port 8080 is open before running the rules tests.

**Files:**
- [MODIFY] [sender-profile-security-rules.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/sender-profile-security-rules.test.ts)
- [MODIFY] [message-template-security-rules.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/message-template-security-rules.test.ts)
- [MODIFY] [industry-security-rules.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/industry-security-rules.test.ts)

- [ ] **Step 1: Update `sender-profile-security-rules.test.ts`**
  Add top-level check:
  ```typescript
  import { connect } from 'node:net';

  async function isEmulatorRunning(port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = connect(port, '127.0.0.1');
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.end();
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  const emulatorRunning = await isEmulatorRunning(8080);
  ```
  Wrap the main test suite:
  ```typescript
  describe.skipIf(!emulatorRunning)('sender_profiles Security Rules (org isolation)', () => {
  ```
- [ ] **Step 2: Update `message-template-security-rules.test.ts`**
  Add connection check and update `describe` to `describe.skipIf(!emulatorRunning)('message_templates Security Rules', () => {`.
- [ ] **Step 3: Update `industry-security-rules.test.ts`**
  Add connection check and update `describe` to `describe.skipIf(!emulatorRunning)('industry Security Rules', () => {`.

---

### Task 2: Verification

We will verify all modified test suites pass or skip correctly without errors.

- [ ] **Step 1: Run all rules tests locally**
  Run: `npx vitest run src/lib/__tests__/sender-profile-security-rules.test.ts src/lib/__tests__/message-template-security-rules.test.ts src/lib/__tests__/industry-security-rules.test.ts`
  Confirm they all skip cleanly without throwing aggregate socket errors.
