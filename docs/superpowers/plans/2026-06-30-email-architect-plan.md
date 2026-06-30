# Email Builder Architect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the AI-powered Email Builder Architect into the visual templates builder, enabling users to generate email layout blocks from prompts and images.

**Architecture:** A Server Action invoking Genkit with a strict block validation schema, paired with a React sidebar interface in the template workshop supporting file uploads to Firebase Storage, layout modes, and state rollbacks.

**Tech Stack:** Next.js (Server Actions), React, Genkit (Claude/Gemini models resolution), Firebase Storage.

---

## Risk Analysis & Refactoring Strategy

### 1. What Could Go Wrong & Resolutions
* **Invalid Block Formats / Types**: 
  * *Risk*: The AI returns unsupported types or styles.
  * *Resolution*: Define strict Zod validation schemas using Genkit's structured output. Any generated blocks failing this schema are rejected, and defaults are applied.
* **Large Image Upload Latency & Storage Bloat**:
  * *Risk*: High-resolution images freeze the UI or consume excessive Firebase storage.
  * *Resolution*: Implement size limits (< 4MB) and client-side scaling/compression before uploading.
* **Canvas Rendering Performance**:
  * *Risk*: Inserting a large array of blocks causes long-frame rendering blocks.
  * *Resolution*: Batch updates and wrap changes inside React's `useTransition`.

### 2. Affected Features
* **Email Compiler (`messaging-utils.ts`)**: Ensure generated columns and blocks match styles compiled into MJML/HTML to prevent styling bugs.
* **Branding Profiles**: Provide branding keys to Genkit to ensure button backgrounds and heading colors align with organization brand settings.

---

## File Structure

### Modified Files:
* `src/lib/campaign-ai.ts`: Add `generateEmailBlocksAction` server action.
* `src/app/admin/messaging/templates/components/template-workshop.tsx`: Embed the architect UI panel, integrate generation calls, and implement state checkpointing.

---

## Task List

### Task 1: Zod Schema and Server Action Implementation

**Files:**
- Modify: `src/lib/campaign-ai.ts`

- [ ] **Step 1: Declare structured block schema and server action in `campaign-ai.ts`**
  Add the following Zod definition and server action code:

```typescript
import { z } from 'genkit';

const ArchitectBlockStyleSchema = z.object({
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  borderRadius: z.string().optional(),
});

const ArchitectBlockSchema = z.object({
  type: z.enum(['heading', 'text', 'image', 'video', 'button', 'divider', 'columns']),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
  style: ArchitectBlockStyleSchema.optional(),
});

// Since columns can have recursive blocks, we define a recursive structure
const FullBlockSchema = ArchitectBlockSchema.extend({
  columns: z.array(z.object({
    width: z.string(),
    blocks: z.array(ArchitectBlockSchema)
  })).optional()
});

const ArchitectResultSchema = z.object({
  blocks: z.array(FullBlockSchema),
});

export async function generateEmailBlocksAction(params: {
  prompt: string;
  imageUrl?: string;
  mode: 'layout_analysis' | 'direct_placement';
  organizationId?: string;
  brandColors?: { primary?: string; secondary?: string; background?: string };
}): Promise<{ success: boolean; blocks?: any[]; error?: string }> {
  try {
    const brandGuidance = params.brandColors 
      ? `Brand Guidelines: Primary color is ${params.brandColors.primary || '#2563eb'}. Secondary color is ${params.brandColors.secondary || '#475569'}.`
      : 'Brand Guidelines: Use standard professional enterprise styles (e.g. blue buttons, dark text).';

    const systemPrompt = `You are a visual email designer and layout architect.
Generate structured email layout blocks based on the user request.
${brandGuidance}

Mode Guidelines:
- "layout_analysis": Analyze the provided visual mockup/inspiration image and recreate its core grid, headers, and text structure in blocks.
- "direct_placement": Include the provided image URL directly in an image block, generating copywriting and paragraphs around it.

Rules:
1. Output MUST strictly match the structured schema.
2. For headers, use type 'heading' with 'h1', 'h2', or 'h3'.
3. For body text, use type 'text'.
4. For columns, partition sections evenly (e.g. two columns with width '50%').`;

    const modelParams = {
      prompt: [
        { text: `${systemPrompt}\nUser prompt: "${params.prompt}"` },
        ...(params.imageUrl ? [{ media: { url: params.imageUrl, contentType: 'image/jpeg' } }] : [])
      ],
      organizationId: params.organizationId,
      jsonMode: true,
      schema: ArchitectResultSchema,
    };

    const text = await callGenkit(modelParams);
    const parsed = JSON.parse(text) as { blocks: any[] };

    return {
      success: true,
      blocks: parsed.blocks || []
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown AI error';
    console.error('[EMAIL-ARCHITECT] Action failed:', errMsg);
    return { success: false, error: errMsg };
  }
}
```

- [ ] **Step 2: Save the file changes and verify exports**
  Ensure there are no compilation errors or missing imports in `campaign-ai.ts`.

---

### Task 2: Firebase Storage Client Image Uploader

**Files:**
- Modify: `src/app/admin/messaging/templates/components/template-workshop.tsx`

- [ ] **Step 1: Write helper function for local image upload to Firebase Storage**
  Add the file upload helper inside `template-workshop.tsx` using `firebase/storage`:

```typescript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadArchitectImage(file: File, workspaceId: string): Promise<string> {
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Image size must be less than 4MB');
  }
  const storage = getStorage();
  const storagePath = `workspaces/${workspaceId}/templates/architect/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(fileRef, file);
  return getDownloadURL(snapshot.ref);
}
```

---

### Task 3: Sidebar UI Implementation

**Files:**
- Modify: `src/app/admin/messaging/templates/components/template-workshop.tsx`

- [ ] **Step 1: Add Email Architect component state variables**
  Add states for the architect at the top level of the `TemplateWorkshop` component:

```typescript
    const [architectPrompt, setArchitectPrompt] = React.useState('');
    const [architectImageUrl, setArchitectImageUrl] = React.useState('');
    const [architectMode, setArchitectMode] = React.useState<'layout_analysis' | 'direct_placement'>('layout_analysis');
    const [isArchitecting, setIsArchitecting] = React.useState(false);
    const [lastBlocksBackup, setLastBlocksBackup] = React.useState<any[] | null>(null);
    const [isUploadingImage, setIsUploadingImage] = React.useState(false);
```

- [ ] **Step 2: Add handleArchitectSubmit and handleUndo handlers**
  Add functions to trigger the server action and roll back blocks:

```typescript
    const handleArchitectSubmit = async () => {
        if (!architectPrompt.trim() && !architectImageUrl) {
            toast({ title: 'Input required', description: 'Please enter a description prompt or attach an image.', variant: 'destructive' });
            return;
        }
        setIsArchitecting(true);
        try {
            const { generateEmailBlocksAction } = await import('@/lib/campaign-ai');
            const res = await generateEmailBlocksAction({
                prompt: architectPrompt,
                imageUrl: architectImageUrl || undefined,
                mode: architectMode,
                organizationId: activeOrganizationId || undefined,
            });

            if (res.success && res.blocks) {
                // Map generated blocks to add unique IDs
                const formatted = res.blocks.map((b: any) => ({
                    ...b,
                    id: `${b.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    columns: b.columns?.map((c: any) => ({
                        ...c,
                        blocks: c.blocks?.map((sb: any) => ({
                            ...sb,
                            id: `${sb.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                        })) || []
                    }))
                }));

                // Back up blocks before mutation for Undo capability
                setLastBlocksBackup([...blocks]);
                setBlocks((prev) => [...prev, ...formatted]);
                toast({ title: 'Blocks Appended', description: `Successfully added ${formatted.length} layout blocks.` });
                setArchitectPrompt('');
                setArchitectImageUrl('');
            } else {
                toast({ title: 'Architect Failed', description: res.error || 'Unable to build blocks.', variant: 'destructive' });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Action trigger error';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setIsArchitecting(false);
        }
    };

    const handleUndoArchitect = () => {
        if (lastBlocksBackup) {
            setBlocks(lastBlocksBackup);
            setLastBlocksBackup(null);
            toast({ title: 'Action Undone', description: 'Appended blocks have been removed.' });
        }
    };
```

- [ ] **Step 3: Embed the architect form UI in the blocks list sidebar**
  Render the controls at the top of the sidebar blocks view. Insert the UI block inside `template-workshop.tsx` right above the `Block Types` heading:

```typescript
    {/* Email Architect Card */}
    <div className="bg-card border rounded-xl p-3 mb-4 space-y-3">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" /> Email Architect (AI)
            </span>
            {lastBlocksBackup && (
                <button
                    type="button"
                    onClick={handleUndoArchitect}
                    className="text-[9px] font-black text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100/60 px-2 py-0.5 rounded transition-colors"
                >
                    Undo
                </button>
            )}
        </div>
        <textarea
            value={architectPrompt}
            onChange={(e) => setArchitectPrompt(e.target.value)}
            placeholder="Describe the newsletter sections or outline..."
            className="w-full text-xs bg-muted/40 border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20"
            rows={2}
        />
        <div className="space-y-1.5">
            <input
                type="text"
                value={architectImageUrl}
                onChange={(e) => setArchitectImageUrl(e.target.value)}
                placeholder="Paste public image URL..."
                className="w-full text-[10px] bg-muted/40 border rounded-lg px-2 py-1.5 focus:outline-none"
            />
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    accept="image/*"
                    id="architect-file"
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && activeWorkspaceId) {
                            setIsUploadingImage(true);
                            try {
                                const url = await uploadArchitectImage(file, activeWorkspaceId);
                                setArchitectImageUrl(url);
                            } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Upload error';
                                toast({ title: 'Upload Failed', description: msg, variant: 'destructive' });
                            } finally {
                                setIsUploadingImage(false);
                            }
                        }
                    }}
                />
                <label
                    htmlFor="architect-file"
                    className="flex-1 flex items-center justify-center gap-1 cursor-pointer bg-muted hover:bg-muted-foreground/15 text-[9px] font-semibold py-1.5 px-3 rounded-lg border text-muted-foreground transition-all"
                >
                    <Upload className="h-3 w-3" /> {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                </label>
            </div>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-semibold text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                    type="radio"
                    name="architectMode"
                    checked={architectMode === 'layout_analysis'}
                    onChange={() => setArchitectMode('layout_analysis')}
                />
                Analyze Mockup
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                    type="radio"
                    name="architectMode"
                    checked={architectMode === 'direct_placement'}
                    onChange={() => setArchitectMode('direct_placement')}
                />
                Insert Image
            </label>
        </div>
        <Button
            type="button"
            className="w-full h-8 text-[10px] font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
            onClick={handleArchitectSubmit}
            disabled={isArchitecting || isUploadingImage}
        >
            {isArchitecting ? (
                <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Designing...
                </>
            ) : (
                <>
                    <Sparkles className="h-3 w-3" /> Architect Email
                </>
            )}
        </Button>
    </div>
```

---

## Verification Plan

### Manual Verification
1. Open template workshop Visual Blocks mode.
2. Enter prompt text ("Create layout with header, introductory text, and two columns"). Click **Architect Email** and verify blocks are appended at the bottom of the editor.
3. Click the **Undo** button in the top-right of the Architect sidebar component, and confirm they roll back successfully.
4. Upload an image file, choose **Insert Image**, and verify an image block is added containing the resolved Firebase Storage URL.
