import { z } from 'genkit';

export const CanvasElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'rect', 'circle', 'arrow', 'icon', 'emoji', 'svg']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  zIndex: z.number(),
  rotation: z.number().optional(),
  opacity: z.number().optional(),
  
  // Text Specific
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fill: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textStrokeColor: z.string().optional(),
  textStrokeWidth: z.number().optional(),
  
  // Badge/Card Background behind text
  badgeColor: z.string().optional(),
  badgeOpacity: z.number().optional(),
  textEffect: z.enum(['none', 'neon', '3d', 'gradient', 'metallic']).optional(),

  // Image Specific
  imageSrc: z.string().optional(),
  imageOutlineColor: z.string().optional(),
  imageOutlineWidth: z.number().optional(),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference']).optional(),
  
  // Shapes & SVGs
  shapeFill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  svgPath: z.string().optional(),
});

export const GenerateThumbnailInputSchema = z.object({
  prompt: z.string().describe('User instructions or core topic description.'),
  videoUrl: z.string().url().optional().describe('An optional video URL to extract context from.'),
  subjectImageUrls: z.array(z.string().url()).optional().describe('List of selected image asset URLs to position as subjects on the canvas.'),
  templateId: z.string().optional().describe('Optional ID of a template layout formula to enforce.'),
});

export const TopicAnalysisSchema = z.object({
  chosenCopy: z.string().describe('The primary high-CTR headline copy (1-3 words max).'),
  targetAudience: z.string().describe('Target demographic summary.'),
  psychologicalTrigger: z.string().describe('Fear, Greed, Curiosity, Awe, Pride trigger justification.'),
  layoutConcept: z.string().describe('Composition structure description.'),
  alternativeCopies: z.array(z.string()).describe('Alternative copywriting hooks.'),
});

export const DesignSchemeSchema = z.object({
  backgroundColor: z.string().describe('Main background fill hex code.'),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    colors: z.array(z.string()),
    angle: z.number().optional(),
  }).optional().describe('A complementary gradient.'),
  fontHeadline: z.string().describe('Headline typography family (Impact, Montserrat, Anton, Bebas Neue, Outfit).'),
  fontSub: z.string().describe('Subtitle font family.'),
  textColor: z.string().describe('Vibrant text fill color.'),
  strokeColor: z.string().describe('Text outline stroke (e.g. black).'),
  textEffect: z.enum(['none', 'neon', '3d', 'gradient', 'metallic']).describe('Applied text effect style.'),
});

export const GenerateThumbnailOutputSchema = z.object({
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    colors: z.array(z.string()),
    angle: z.number().optional(),
  }).optional(),
  elements: z.array(CanvasElementSchema),
  explanation: z.string(),
  alternativeCopies: z.array(z.string()).optional(),
});

export const ModifyThumbnailInputSchema = z.object({
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    colors: z.array(z.string()),
    angle: z.number().optional(),
  }).optional(),
  elements: z.array(CanvasElementSchema),
  instruction: z.string().describe('User requested modification command.'),
});

export const ModifyThumbnailOutputSchema = z.object({
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    colors: z.array(z.string()),
    angle: z.number().optional(),
  }).optional(),
  elements: z.array(CanvasElementSchema),
  explanation: z.string(),
});

export const HookAlternativeSchema = z.object({
  text: z.string().describe('The short title hook text (1-3 words max).'),
  score: z.number().min(0).max(100).describe('Predicted CTR score (e.g., 75-98) based on copywriting rules.'),
  emotion: z.enum(['Greed', 'Curiosity', 'Fear', 'Awe', 'Pride']).describe('Psychological emotional hook trigger category.'),
  readability: z.enum(['High', 'Excellent', 'Standard']).describe('Visual readability scale based on text length.'),
});

export const GenerateHooksInputSchema = z.object({
  topic: z.string().describe('The raw title topic or description to brainstorm hooks for.'),
});

export const GenerateHooksOutputSchema = z.object({
  hooks: z.array(HookAlternativeSchema),
});
