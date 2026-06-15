# System Design Spec: Industrial-Grade AI System Expansion (Templates, Scripts, Automations)

This specification outlines the architecture, data models, schema definitions, and implementation guidelines for expanding our generative AI capabilities, global model selection, and self-improving learning loop across all major administration interfaces.

---

## 1. Architectural Expansion of AI Flow Registry

We will register three new Genkit flows to handle the creation of templates, communication scripts, and workflow automations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Genkit Flow Registry                          │
├───────────────────┬─────────────────────────┬───────────────────────────┤
│  Template Flow    │       Script Flow       │      Automation Flow      │
│  (Email layout)   │   (SMS/WhatsApp copy)   │     (Workflow engine)     │
└───────────────────┴─────────────────────────┴───────────────────────────┘
```

### A. Template Creation Flow
Generates structured email templates (HTML layouts, subject lines, preview text) with support for merge tags.

- **Flow Input Schema** (`GenerateTemplateInputSchema`):
  ```typescript
  const GenerateTemplateInputSchema = z.object({
    prompt: z.string().describe("User prompt describing desired email."),
    channel: z.enum(['email', 'in_app']),
    category: z.string().optional().describe("e.g., onboarding, follow_up, billing"),
    variables: z.array(z.string()).describe("List of available CRM merge tags (e.g., {{contact.firstName}})."),
    organizationId: z.string().optional(),
    provider: z.string().optional(),
    modelId: z.string().optional(),
  });
  ```
- **Flow Output Schema** (`GenerateTemplateOutputSchema`):
  ```typescript
  const GenerateTemplateOutputSchema = z.object({
    subject: z.string().describe("Engaging subject line incorporating variables where appropriate."),
    previewText: z.string().max(150).describe("Email preheader text."),
    htmlBody: z.string().describe("Clean, inline-styled responsive HTML matching design system standards."),
    recommendedTriggers: z.array(z.string()).describe("Suggested automation triggers for this template."),
  });
  ```

### B. Communication Script Creation Flow
Generates short-form conversational copy for SMS or WhatsApp, keeping a strong tone of voice and respecting character constraints.

- **Flow Input Schema** (`GenerateScriptInputSchema`):
  ```typescript
  const GenerateScriptInputSchema = z.object({
    prompt: z.string().describe("Instructions for script content."),
    channel: z.enum(['sms', 'whatsapp']),
    variables: z.array(z.string()).describe("List of CRM merge tags."),
    tone: z.enum(['professional', 'warm', 'urgent', 'friendly']).default('friendly'),
    organizationId: z.string().optional(),
    provider: z.string().optional(),
    modelId: z.string().optional(),
  });
  ```
- **Flow Output Schema** (`GenerateScriptOutputSchema`):
  ```typescript
  const GenerateScriptOutputSchema = z.object({
    message: z.string().describe("The conversational message body, correctly escaped and formatted."),
    hasMedia: z.boolean(),
    mediaPlaceholderUrl: z.string().optional().describe("Suggested background or graphic URL if channel is WhatsApp."),
    estimatedReadTimeSeconds: z.number(),
  });
  ```

### C. Workflow Automation Creation Flow
Generates a structured automation engine workflow (triggers, conditional logic steps, action blocks) based on a description.

- **Flow Input Schema** (`GenerateAutomationInputSchema`):
  ```typescript
  const GenerateAutomationInputSchema = z.object({
    prompt: z.string().describe("Natural language description of the automation flow."),
    availableTemplates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string()
    })).describe("Templates registered in the workspace that the AI can reference and trigger."),
    organizationId: z.string().optional(),
    provider: z.string().optional(),
    modelId: z.string().optional(),
  });
  ```
- **Flow Output Schema** (`GenerateAutomationOutputSchema`):
  - Injects direct schemas from the automation builder configuration:
  ```typescript
  const GenerateAutomationOutputSchema = z.object({
    name: z.string(),
    description: z.string(),
    trigger: z.object({
      type: z.string().describe("e.g. tag_added, form_submitted, delay_completed"),
      config: z.record(z.any()),
    }),
    steps: z.array(z.object({
      id: z.string(),
      type: z.enum(['action', 'condition', 'delay']),
      config: z.record(z.any()),
      nextStepId: z.string().optional(),
    })),
  });
  ```

---

## 2. Universal Model Selector & Modal Standard

To ensure that the user can choose the active AI model across all interfaces, we will standardize our modals using a shared header layout.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Modal: AI Assistant                                               [X]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Target Model: [ Google Gemini 3 Flash  ▼ ]                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Prompt Input                                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                                                          [ Run AI ]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### A. The Core standard components
Every AI-assistance UI modal MUST utilize the shared `<AiModelSelector hideLabel={true} />` inside a standardised layout widget:

```tsx
import * as React from 'react';
import AiModelSelector from '@/components/ai/AiModelSelector';
import { Sparkles, X } from 'lucide-react';

interface AiAssistantModalHeaderProps {
  title: string;
  description?: string;
  onClose: () => void;
}

export function AiAssistantModalHeader({
  title,
  description,
  onClose,
}: AiAssistantModalHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-border/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <h3 className="font-bold text-sm text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Universal Model Selector */}
          <AiModelSelector hideLabel={true} className="scale-90 origin-right" />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground leading-normal">{description}</p>
      )}
    </div>
  );
}
```

### B. Shared State Hook
To keep model state fully synchronized with the calling flow, we subscribe to Firestore real-time preference changes using a React hook:

```typescript
import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { UserProfile } from '@/lib/types';

export function useLiveAiModel() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [provider, setProvider] = React.useState('googleai');
  const [modelId, setModelId] = React.useState('gemini-3-flash-preview');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !firestore) return;
    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.preferredAiProvider) setProvider(data.preferredAiProvider);
        if (data.preferredAiModel) setModelId(data.preferredAiModel);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, firestore]);

  return { provider, modelId, loading };
}
```

---

## 3. Extending the Learning Loop (ULL)

We will expand the Unified Learning Loop to cover templates, scripts, and automations. The lifecycle logic hooks into edit boundaries and checks for validation errors.

```
      [ AI Generates Output ]
                 │
                 ▼ (createLearningSignalAction)
      [ User Modifies Fields ]
                 │
                 ▼ (touchedFields / formState)
      [ User Clicks Save/Publish ]
                 │
                 ▼ (finalizeLearningSignalAction)
      [ Calculate JSON Structural Diff ]
```

### A. Lifecycle Hooks for Save Managers
1. **Initial Signal Registration**:
   Upon generation, the client triggers `createLearningSignalAction` supplying:
   - `prompt`: The user's instructions.
   - `initialState`: The raw output JSON.
   - `artifactType`: `'survey' | 'template' | 'script' | 'automation'`.
   The returned `signalId` is stored in the client component's local memory or draft document metadata.

2. **Finalization Signal (Reinforcement)**:
   When the user clicks "Save" or "Publish", the client triggers `finalizeLearningSignalAction(signalId, finalState, validationErrors)` in a non-blocking `after()` routine.

---

## 4. Semantic JSON Structural Diffing Algorithm

To replace the character-length-based Levenshtein distance placeholder in ULL, we will write a structured JSON diffing utility. This detects structural shifts (which reflect true "correction signals") rather than cosmetic edits.

```typescript
interface JSONDiffResult {
  editDistance: number;
  corrections: {
    addedKeys: string[];
    removedKeys: string[];
    modifiedValues: string[];
  };
}

/**
 * Calculates a semantic structural edit distance between initial and final JSON outputs.
 * Returns a normalized float between 0.0 (perfect generation) and 1.0 (complete rewrite).
 */
export function calculateJsonDiff(initial: any, final: any): JSONDiffResult {
  const result = {
    addedKeys: [] as string[],
    removedKeys: [] as string[],
    modifiedValues: [] as string[],
  };

  const traverseAndDiff = (initObj: any, finObj: any, path: string = '') => {
    // If types differ, it's a complete overwrite at this node
    if (typeof initObj !== typeof finObj || Array.isArray(initObj) !== Array.isArray(finObj)) {
      result.modifiedValues.push(path);
      return;
    }

    // Handle Arrays (e.g. survey elements, automation steps, template blocks)
    if (Array.isArray(initObj)) {
      const maxLength = Math.max(initObj.length, finObj.length);
      for (let i = 0; i < maxLength; i++) {
        if (initObj[i] === undefined) {
          result.addedKeys.push(`${path}[${i}]`);
        } else if (finObj[i] === undefined) {
          result.removedKeys.push(`${path}[${i}]`);
        } else {
          traverseAndDiff(initObj[i], finObj[i], `${path}[${i}]`);
        }
      }
      return;
    }

    // Handle Objects
    if (typeof initObj === 'object' && initObj !== null && finObj !== null) {
      const initKeys = Object.keys(initObj);
      const finKeys = Object.keys(finObj);

      initKeys.forEach(key => {
        if (!finKeys.includes(key)) {
          result.removedKeys.push(`${path ? `${path}.` : ''}${key}`);
        } else {
          traverseAndDiff(initObj[key], finObj[key], `${path ? `${path}.` : ''}${key}`);
        }
      });

      finKeys.forEach(key => {
        if (!initKeys.includes(key)) {
          result.addedKeys.push(`${path ? `${path}.` : ''}${key}`);
        }
      });
      return;
    }

    // Handle Primitives
    if (initObj !== finObj) {
      result.modifiedValues.push(path);
    }
  };

  traverseAndDiff(initial, final);

  // Heuristic calculation: total differences divided by the size of the final object
  const totalEdits = result.addedKeys.length + result.removedKeys.length + result.modifiedValues.length;
  
  // Safely measure approximate weight of object
  const totalNodes = JSON.stringify(final).split(/[:{[,]/).length || 1;
  const editDistance = Math.min(totalEdits / totalNodes, 1.0);

  return {
    editDistance,
    corrections: result,
  };
}
```

---

## 5. Next Steps Plan

To move this to production:
1. **Phase 1: Dynamic Heuristic Diffing** — Replace the current edit distance code with `calculateJsonDiff` to improve few-shot accuracy.
2. **Phase 2: Universal Model Selector Header** — Replace modal headers inside Survey Generator and PDF field mapper with the standardized `<AiAssistantModalHeader>`.
3. **Phase 3: Auxiliary Flows Refactoring** — Update all mapping/detection flows to inherit the user's active model.
4. **Phase 4: Expansion** — Build the Genkit flows for templates, scripts, and automations and link them to ULL.
