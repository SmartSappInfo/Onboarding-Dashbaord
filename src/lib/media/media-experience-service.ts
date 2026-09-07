/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Media Experiences:
 *    Manages creation, updates, and retrieval of `MediaExperience` records (presentation layouts,
 *    branding kits, player controls, custom CSS, and theme colors).
 * 2. Strict Typing & Zero `any`:
 *    All inputs, return signatures, and Firestore conversion maps enforce strict typing.
 */

import { 
  collection, doc, getDoc, getDocs, query, where, 
  setDoc, updateDoc, orderBy, type Firestore, type QueryConstraint 
} from 'firebase/firestore';
import type { 
  MediaExperience, 
  ExperienceTemplate, 
  ExperienceTheme, 
  PlayerControlsConfig,
  DynamicCtaRule,
  PersonalizationConfig,
  ContentRecommendation,
  ABExperimentConfig
} from '../types/media-2.0';

export interface CreateExperienceParams {
  workspaceId: string;
  assetId: string;
  title: string;
  description?: string;
  template: ExperienceTemplate;
  theme?: Partial<ExperienceTheme>;
  playerControls?: Partial<PlayerControlsConfig>;
  ctaGateId?: string;
  customHeaderTitle?: string;
  customHeaderSubtitle?: string;
  isDefault?: boolean;
  dynamicCtaRules?: DynamicCtaRule[];
  personalization?: PersonalizationConfig;
  recommendations?: ContentRecommendation;
  abExperiment?: ABExperimentConfig;
  createdById: string;
}

export const DEFAULT_EXPERIENCE_THEME: ExperienceTheme = {
  primaryColorHex: '#3b82f6',
  backgroundColorHex: '#0f172a',
  textColorHex: '#ffffff',
};

export const DEFAULT_PLAYER_CONTROLS: PlayerControlsConfig = {
  autoplay: false,
  showPlaybackSpeed: true,
  showQualitySelector: true,
  allowDownload: true,
  loop: false,
  showCaptions: true,
};

/**
 * Creates a new MediaExperience presentation document in Firestore.
 */
export async function createExperienceAction(
  firestore: Firestore,
  params: CreateExperienceParams
): Promise<MediaExperience | null> {
  if (!firestore || !params.workspaceId || !params.assetId || !params.title) return null;

  try {
    const expId = doc(collection(firestore, 'media_experiences')).id;
    const newExperience: MediaExperience = {
      id: expId,
      workspaceId: params.workspaceId,
      assetId: params.assetId,
      title: params.title,
      description: params.description || '',
      template: params.template,
      theme: { ...DEFAULT_EXPERIENCE_THEME, ...params.theme },
      playerControls: { ...DEFAULT_PLAYER_CONTROLS, ...params.playerControls },
      ctaGateId: params.ctaGateId,
      customHeaderTitle: params.customHeaderTitle,
      customHeaderSubtitle: params.customHeaderSubtitle,
      isDefault: params.isDefault || false,
      dynamicCtaRules: params.dynamicCtaRules,
      personalization: params.personalization,
      recommendations: params.recommendations,
      abExperiment: params.abExperiment,
      createdById: params.createdById,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(firestore, 'media_experiences', expId), newExperience);
    return newExperience;
  } catch (err: unknown) {
    console.error('[createExperienceAction] Error creating media experience:', err);
    return null;
  }
}

/**
 * Retrieves a MediaExperience by ID.
 */
export async function getExperienceAction(
  firestore: Firestore,
  experienceId: string
): Promise<MediaExperience | null> {
  if (!firestore || !experienceId) return null;

  try {
    const snap = await getDoc(doc(firestore, 'media_experiences', experienceId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MediaExperience;
  } catch (err: unknown) {
    console.error('[getExperienceAction] Error fetching experience:', err);
    return null;
  }
}

/**
 * Lists all MediaExperiences for an asset or workspace sorted by creation date descending.
 */
export async function listExperiencesAction(
  firestore: Firestore,
  workspaceId: string,
  assetId?: string
): Promise<MediaExperience[]> {
  if (!firestore || !workspaceId) return [];

  try {
    const colRef = collection(firestore, 'media_experiences');
    const constraints: QueryConstraint[] = [where('workspaceId', '==', workspaceId)];
    if (assetId) {
      constraints.push(where('assetId', '==', assetId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaExperience));
  } catch (err: unknown) {
    console.error('[listExperiencesAction] Error listing experiences:', err);
    return [];
  }
}

/**
 * Updates an existing MediaExperience document.
 */
export async function updateExperienceAction(
  firestore: Firestore,
  experienceId: string,
  updates: Partial<Omit<MediaExperience, 'id' | 'createdAt'>>
): Promise<boolean> {
  if (!firestore || !experienceId) return false;

  try {
    const ref = doc(firestore, 'media_experiences', experienceId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err: unknown) {
    console.error('[updateExperienceAction] Error updating experience:', err);
    return false;
  }
}
