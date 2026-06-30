# Email Builder Architect Design Specification

**Date**: 2026-06-30  
**Feature**: Email Builder Architect (AI-powered block generator)  
**Location**: Template Builder (Email Visual Blocks flow)

---

## 1. Goal

Introduce an AI assistant (Email Builder Architect) inside the template builder sidebar under the "Blocks" tab. The assistant allows users to describe their layout/copy in natural language or upload/paste an image mockup/inspiration, converting the request into structured email blocks appended directly onto the email canvas.

---

## 2. User Review Required

> [!IMPORTANT]
> The generation relies on the existing Genkit models (Claude 3.5 Sonnet / Gemini). When visual mockups/screenshots are provided, a multimodal-capable model is dynamically resolved to support visual parsing.

---

## 3. Architecture & Data Flow

### Sequence Flow
1. **User input**: User provides prompt text, image input (URL or file upload), and chooses an operational mode.
2. **Server Action**: Invokes `generateEmailBlocksAction` with parameters.
3. **Model Resolution**: Resolves appropriate model (multimodal if an image is attached).
4. **Genkit Call**: Triggers AI generation matching a Zod schema defining the output blocks structure.
5. **UI Update**: Canvas receives the list of blocks, appends them, and creates an undo checkpoint.

### Genkit Block Zod Schema
```typescript
import { z } from 'genkit';

const BlockStyleSchema = z.object({
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  borderRadius: z.string().optional(),
});

const SingleBlockSchema = z.object({
  type: z.enum(['heading', 'text', 'image', 'video', 'button', 'divider', 'columns']),
  title: z.string().optional().describe('Used for heading title, button text, or column items headers'),
  content: z.string().optional().describe('Main paragraph text inside text blocks'),
  url: z.string().optional().describe('For images, video links, or button action links'),
  variant: z.enum(['h1', 'h2', 'h3']).optional().describe('Heading visual sizing'),
  style: BlockStyleSchema.optional(),
  columns: z.array(z.object({
    width: z.string(),
    blocks: z.array(z.lazy(() => SingleBlockSchema))
  })).optional()
});
```

---

## 4. UI/UX Specifications

### Input Controls
1. **Prompt textarea**: Prompt input for describing contents, layout, or copy goals.
2. **Unified Image Picker**:
   - URL text input.
   - File selector using standard Firebase Storage upload to save images to `templates/architect/` and retrieve public download URL.
3. **Mode selector toggle**:
   - `layout_analysis` (recreate design structures from mockup image).
   - `direct_placement` (insert image as-is, generating copy around it).
4. **Undo Banner**: Floating banner below the architect panel: `Blocks generated. [Undo]`.

---

## 5. Verification Plan

### Automated Tests
- Test server action parameters validation.
- Mock Genkit response to ensure parsed blocks strictly match `MessageBlock` structures.

### Manual Verification
- Deploy and try multiple prompts (e.g. "Create a newsletter layout with a header, body, and call to action button").
- Upload a mockup screenshot and verify blocks map alignment and content structure accurately.
