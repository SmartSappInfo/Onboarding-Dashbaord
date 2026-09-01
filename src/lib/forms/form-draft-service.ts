/**
 * SmartSapp Forms 2.0 Local Draft Persistence Service
 * 
 * Provides client-side autosave and recovery using localStorage.
 */

export interface LocalFormDraft {
  formId: string;
  data: Record<string, unknown>;
  currentPageIndex: number;
  lastSavedAt: string;
}

const STORAGE_PREFIX = 'smartsapp_form_draft_';

export const FormDraftService = {
  /**
   * Saves form data locally in localStorage.
   */
  saveLocalDraft(formId: string, data: Record<string, unknown>, currentPageIndex: number): void {
    if (typeof window === 'undefined') return;
    try {
      const draft: LocalFormDraft = {
        formId,
        data,
        currentPageIndex,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${formId}`, JSON.stringify(draft));
    } catch {
      // Storage quota or private browsing exceptions handled silently
    }
  },

  /**
   * Retrieves a saved local draft for a form.
   */
  getLocalDraft(formId: string): LocalFormDraft | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${formId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocalFormDraft;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Clears a local draft upon successful form submission.
   */
  clearLocalDraft(formId: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${formId}`);
    } catch {
      // Silently catch
    }
  },
};
