# Helper Utilities Specification
## New Utility Functions to Create

---

## File: src/lib/school-helpers.ts

**Purpose:** Provide backward-compatible accessors for School model migration

**Status:** TO BE CREATED in Phase 2.1

### Function Specifications

```typescript
import type { School, FocalPerson } from './types';

/**
 * Gets the primary contact person for a school.
 * Priority: First signatory, then first focal person.
 * 
 * @param school - The school object
 * @returns The primary focal person or undefined if none exist
 * 
 * @example
 * const primary = getPrimaryContact(school);
 * if (primary) {
 *   console.log(primary.name, primary.email);
 * }
 */
export function getPrimaryContact(school: School): FocalPerson | undefined {
  if (!school.focalPersons || school.focalPersons.length === 0) {
    return undefined;
  }
  
  const signatory = school.focalPersons.find(fp => fp.isSignatory);
  return signatory || school.focalPersons[0];
}

/**
 * Gets the primary email address for a school.
 * 
 * @param school - The school object
 * @returns The primary email or undefined
 * 
 * @example
 * const email = getSchoolEmail(school);
 * if (email) {
 *   await sendEmail(email, subject, body);
 * }
 */
export function getSchoolEmail(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.email;
}

/**
 * Gets the primary phone number for a school.
 * 
 * @param school - The school object
 * @returns The primary phone or undefined
 * 
 * @example
 * const phone = getSchoolPhone(school);
 * if (phone) {
 *   await sendSMS(phone, message);
 * }
 */
export function getSchoolPhone(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.phone;
}

/**
 * Gets the primary contact person's name.
 * 
 * @param school - The school object
 * @returns The contact person's name or undefined
 * 
 * @example
 * const name = getContactPerson(school);
 * console.log(`Contact: ${name || 'Not specified'}`);
 */
export function getContactPerson(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.name;
}

/**
 * Gets all email addresses for a school (all focal persons).
 * 
 * @param school - The school object
 * @returns Array of email addresses
 * 
 * @example
 * const emails = getAllSchoolEmails(school);
 * await sendBulkEmail(emails, subject, body);
 */
export function getAllSchoolEmails(school: School): string[] {
  if (!school.focalPersons) return [];
  return school.focalPersons
    .map(fp => fp.email)
    .filter((email): email is string => !!email);
}

/**
 * Gets all phone numbers for a school (all focal persons).
 * 
 * @param school - The school object
 * @returns Array of phone numbers
 * 
 * @example
 * const phones = getAllSchoolPhones(school);
 * await sendBulkSMS(phones, message);
 */
export function getAllSchoolPhones(school: School): string[] {
  if (!school.focalPersons) return [];
  return school.focalPersons
    .map(fp => fp.phone)
    .filter((phone): phone is string => !!phone);
}

/**
 * Gets the signatory focal person (for contracts).
 * 
 * @param school - The school object
 * @returns The signatory focal person or undefined
 * 
 * @example
 * const signatory = getSignatory(school);
 * if (signatory) {
 *   await generateContract(school, signatory);
 * }
 */
export function getSignatory(school: School): FocalPerson | undefined {
  if (!school.focalPersons) return undefined;
  return school.focalPersons.find(fp => fp.isSignatory);
}

/**
 * Checks if a school has a valid primary contact.
 * 
 * @param school - The school object
 * @returns True if school has at least one focal person with email
 * 
 * @example
 * if (hasValidContact(school)) {
 *   await sendWelcomeEmail(school);
 * }
 */
export function hasValidContact(school: School): boolean {
  const primary = getPrimaryContact(school);
  return !!(primary && primary.email);
}

/**
 * Formats a school's contact information for display.
 * 
 * @param school - The school object
 * @returns Formatted contact string
 * 
 * @example
 * const contact = formatSchoolContact(school);
 * // Returns: "John Doe (john@school.com, +233123456789)"
 */
export function formatSchoolContact(school: School): string {
  const primary = getPrimaryContact(school);
  if (!primary) return 'No contact information';
  
  const parts = [primary.name];
  if (primary.email) parts.push(primary.email);
  if (primary.phone) parts.push(primary.phone);
  
  return parts.join(' • ');
}
```

---

## File: src/lib/workspace-helpers.ts

**Purpose:** Provide utilities for workspace ID handling

**Status:** TO BE CREATED in Phase 2.2

### Function Specifications

```typescript
import type { School, Workspace } from './types';

/**
 * Gets the primary workspace ID for a school.
 * 
 * @param school - The school object
 * @returns The first workspace ID or 'onboarding' as fallback
 * 
 * @example
 * const workspaceId = getPrimaryWorkspaceId(school);
 * await logActivity({ workspaceId, ... });
 */
export function getPrimaryWorkspaceId(school: School): string {
  if (!school.workspaceIds || school.workspaceIds.length === 0) {
    return 'onboarding'; // Default fallback
  }
  return school.workspaceIds[0];
}

/**
 * Checks if a school belongs to a specific workspace.
 * 
 * @param school - The school object
 * @param workspaceId - The workspace ID to check
 * @returns True if school is in the workspace
 * 
 * @example
 * if (isInWorkspace(school, 'prospect')) {
 *   // Handle prospect logic
 * }
 */
export function isInWorkspace(school: School, workspaceId: string): boolean {
  if (!school.workspaceIds) return false;
  return school.workspaceIds.includes(workspaceId);
}

/**
 * Checks if a school is a prospect.
 * 
 * @param school - The school object
 * @returns True if school is in prospect workspace
 */
export function isProspect(school: School): boolean {
  return isInWorkspace(school, 'prospect');
}

/**
 * Checks if a school is in onboarding.
 * 
 * @param school - The school object
 * @returns True if school is in onboarding workspace
 */
export function isOnboarding(school: School): boolean {
  return isInWorkspace(school, 'onboarding');
}

/**
 * Gets all workspace IDs for a school as a comma-separated string.
 * 
 * @param school - The school object
 * @returns Comma-separated workspace IDs
 * 
 * @example
 * const workspaces = getWorkspaceIdsString(school);
 * // Returns: "onboarding,active"
 */
export function getWorkspaceIdsString(school: School): string {
  if (!school.workspaceIds || school.workspaceIds.length === 0) {
    return 'onboarding';
  }
  return school.workspaceIds.join(',');
}
```

---

## File: src/lib/type-guards.ts

**Purpose:** Type guard utilities for runtime type checking

**Status:** TO BE CREATED in Phase 2.3

### Function Specifications

```typescript
import type { 
  School, 
  Survey, 
  PDFForm, 
  Task, 
  Activity,
  SurveyQuestion,
  SurveyLayoutBlock,
  SurveyLogicBlock
} from './types';

/**
 * Type guard to check if an object is a School.
 */
export function isSchool(obj: any): obj is School {
  return obj && typeof obj === 'object' && 'name' in obj && 'workspaceIds' in obj;
}

/**
 * Type guard to check if an object is a Survey.
 */
export function isSurvey(obj: any): obj is Survey {
  return obj && typeof obj === 'object' && 'elements' in obj && 'slug' in obj;
}

/**
 * Type guard to check if a survey element is a question.
 */
export function isSurveyQuestion(element: any): element is SurveyQuestion {
  const questionTypes = ['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone'];
  return element && questionTypes.includes(element.type);
}

/**
 * Type guard to check if a survey element is a layout block.
 */
export function isSurveyLayoutBlock(element: any): element is SurveyLayoutBlock {
  const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section', 'logic'];
  return element && layoutTypes.includes(element.type);
}

/**
 * Type guard to check if a survey element is a logic block.
 */
export function isSurveyLogicBlock(element: any): element is SurveyLogicBlock {
  return element && element.type === 'logic' && 'rules' in element;
}

/**
 * Type guard to check if an object is a Task.
 */
export function isTask(obj: any): obj is Task {
  return obj && typeof obj === 'object' && 'title' in obj && 'status' in obj && 'priority' in obj;
}

/**
 * Type guard to check if an object is an Activity.
 */
export function isActivity(obj: any): obj is Activity {
  return obj && typeof obj === 'object' && 'type' in obj && 'timestamp' in obj && 'workspaceId' in obj;
}
```

---

## File: src/lib/validation-helpers.ts

**Purpose:** Common validation utilities

**Status:** TO BE CREATED in Phase 2.3

### Function Specifications

```typescript
/**
 * Validates an email address.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a phone number (basic check).
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validates a slug format.
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Generates a slug from a string.
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Validates required fields in an object.
 */
export function hasRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[]
): boolean {
  return requiredFields.every(field => {
    const value = obj[field];
    return value !== undefined && value !== null && value !== '';
  });
}
```

---

## Usage Examples

### Example 1: Migrating School Email Access

```typescript
// BEFORE
const email = school.email;
if (email) {
  await sendEmail(email, subject, body);
}

// AFTER
import { getSchoolEmail } from '@/lib/school-helpers';

const email = getSchoolEmail(school);
if (email) {
  await sendEmail(email, subject, body);
}
```

### Example 2: Workspace Checking

```typescript
// BEFORE
const isProspect = school.workspaceId === 'prospect';

// AFTER
import { isProspect } from '@/lib/workspace-helpers';

const isProspectSchool = isProspect(school);
```

### Example 3: Type Guards

```typescript
// BEFORE
if (element.type === 'text' || element.type === 'long-text') {
  // Handle question
}

// AFTER
import { isSurveyQuestion } from '@/lib/type-guards';

if (isSurveyQuestion(element)) {
  // TypeScript now knows element is SurveyQuestion
  console.log(element.placeholder);
}
```

---

## Testing Requirements

### Unit Tests to Create

```typescript
// src/lib/__tests__/school-helpers.test.ts
describe('school-helpers', () => {
  describe('getPrimaryContact', () => {
    it('should return signatory if exists', () => {
      // Test implementation
    });
    
    it('should return first focal person if no signatory', () => {
      // Test implementation
    });
    
    it('should return undefined if no focal persons', () => {
      // Test implementation
    });
  });
  
  // More tests...
});
```

---

## Integration Checklist

- [ ] Create src/lib/school-helpers.ts
- [ ] Create src/lib/workspace-helpers.ts
- [ ] Create src/lib/type-guards.ts
- [ ] Create src/lib/validation-helpers.ts
- [ ] Write unit tests for all helpers
- [ ] Update imports in affected files
- [ ] Run typecheck to verify
- [ ] Test critical user flows
- [ ] Update documentation

---

**Status:** SPECIFICATION COMPLETE  
**Ready for Implementation:** Phase 2.1  
**Last Updated:** March 23, 2026
