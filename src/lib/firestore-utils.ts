/**
 * Utility functions for Firestore data handling
 */

/**
 * Recursively removes undefined values from an object to make it Firestore-compatible.
 * Firestore doesn't allow undefined values, so we need to clean the data before saving.
 * 
 * @param obj - The object to clean
 * @returns A new object with undefined values removed
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as T;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanFirestoreData(item))
      .filter(item => item !== undefined) as T;
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  
  return obj;
}

/**
 * Validates that an object doesn't contain undefined values (recursively)
 * 
 * @param obj - The object to validate
 * @param path - Current path for error reporting (internal use)
 * @returns Array of paths that contain undefined values
 */
export function findUndefinedPaths(obj: any, path: string = ''): string[] {
  const undefinedPaths: string[] = [];
  
  if (obj === undefined) {
    return [path || 'root'];
  }
  
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      undefinedPaths.push(...findUndefinedPaths(item, itemPath));
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key;
      undefinedPaths.push(...findUndefinedPaths(value, keyPath));
    }
  }
  
  return undefinedPaths;
}

/**
 * Prepares survey data for Firestore by cleaning undefined values and adding timestamps
 * 
 * @param surveyData - The survey data to prepare
 * @param isUpdate - Whether this is an update (preserves createdAt) or new document
 * @returns Cleaned survey data ready for Firestore
 */
export function prepareSurveyForFirestore(surveyData: any, isUpdate: boolean = false) {
  const timestamp = new Date().toISOString();
  
  const dataWithTimestamps = {
    ...surveyData,
    updatedAt: timestamp,
    ...(isUpdate ? {} : { createdAt: timestamp })
  };
  
  // Clean undefined values
  const cleanedData = cleanFirestoreData(dataWithTimestamps);
  
  // Validate no undefined values remain
  const undefinedPaths = findUndefinedPaths(cleanedData);
  if (undefinedPaths.length > 0) {
    console.warn('Found undefined values at paths:', undefinedPaths);
    throw new Error(`Survey data contains undefined values at: ${undefinedPaths.join(', ')}`);
  }
  
  return cleanedData;
}

/**
 * Default values for survey fields to prevent undefined values
 */
export const SURVEY_DEFAULTS = {
  backgroundColor: '#F1F5F9',
  backgroundPattern: 'none' as const,
  patternColor: '#3B5FFF',
  showCoverPage: true,
  showSurveyTitles: true,
  startButtonText: "Let's Start",
  submitButtonText: "Submit",
  embedRedirectMode: 'modal' as const,
  scoringEnabled: false,
  maxScore: 0,
  elements: [],
  resultRules: [],
  resultPages: [],
  status: 'draft' as const,
  adminAlertsEnabled: false,
  adminAlertChannel: 'both' as const,
  adminAlertNotifyManager: false,
  adminAlertSpecificUserIds: [],
  externalAlertsEnabled: false,
  externalAlertChannel: 'both' as const,
  externalAlertContactTypes: [],
  webhookEnabled: false,
  showDebugProcessingModal: false,
  useEntityLogo: false,
  createEntity: false,
  assignmentEnabled: false,
  autoTags: [],
  autoAutomations: []
} as const;

/**
 * Applies default values to survey data to prevent undefined fields
 * 
 * @param surveyData - The survey data to apply defaults to
 * @returns Survey data with defaults applied
 */
export function applySurveyDefaults(surveyData: any) {
  return {
    ...SURVEY_DEFAULTS,
    ...surveyData,
    // Ensure arrays are never undefined
    elements: surveyData.elements || SURVEY_DEFAULTS.elements,
    resultRules: surveyData.resultRules || SURVEY_DEFAULTS.resultRules,
    resultPages: surveyData.resultPages || SURVEY_DEFAULTS.resultPages,
    workspaceIds: surveyData.workspaceIds || [],
    adminAlertSpecificUserIds: surveyData.adminAlertSpecificUserIds || SURVEY_DEFAULTS.adminAlertSpecificUserIds,
    externalAlertContactTypes: surveyData.externalAlertContactTypes || SURVEY_DEFAULTS.externalAlertContactTypes,
    autoTags: surveyData.autoTags || SURVEY_DEFAULTS.autoTags,
    autoAutomations: surveyData.autoAutomations || SURVEY_DEFAULTS.autoAutomations
  };
}

/**
 * Recursively removes all undefined values from an object or array.
 * Converts undefined values to omitted/deleted keys for Firestore compatibility.
 */
export function pruneUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => pruneUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          result[key] = pruneUndefined(val);
        }
      }
    }
    return result as unknown as T;
  }
  return obj;
}