
export interface School {
  id: string;
  name: string;
  slug: string;
  slogan?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  location?: string;
  nominalRoll?: number;
  modules?: string;
  implementationDate?: string; // ISO string
  referee?: string;
  includeDroneFootage?: boolean;
}

export interface Meeting {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  meetingTime: string; // ISO string
  meetingLink: string;
  recordingUrl?: string;
  brochureUrl?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  fullPath?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  mimeType?: string;
  size?: number;
  uploadedBy: string;
  createdAt: string; // ISO string
  linkTitle?: string;
  linkDescription?: string;
  previewImageUrl?: string;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'rating' | 'date' | 'time' | 'file-upload';
  options?: string[];
  allowOther?: boolean;
  isRequired: boolean;
  visibilityLogic?: {
    questionId: string;
    expectedValue: string | string[];
  };
  branchingLogic?: {
    onValue: string;
    action: 'jump';
    targetElementId: string;
  }[];
}

export interface SurveyLayoutBlock {
  id: string;
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 'audio' | 'document' | 'embed';
  title?: string; // For heading
  text?: string; // For description
  url?: string; // For media types
  html?: string; // For embed
  visibilityLogic?: {
    questionId: string;
    expectedValue: string | string[];
  };
}

export type SurveyElement = SurveyQuestion | SurveyLayoutBlock;

export interface Survey {
  id: string;
  title: string;
  description: string;
  slug: string;
  bannerImageUrl?: string;
  status: 'draft' | 'published' | 'archived';
  elements: SurveyElement[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  submittedAt: string; // ISO string
  answers: {
    questionId: string;
    value: any; // Can be string, string[], number, or object for checkboxes with 'other'
  }[];
}
