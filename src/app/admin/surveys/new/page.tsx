
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, setDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { 
    Check, 
    Loader2, 
    ArrowLeft, 
    ArrowRight, 
    Save, 
    Undo,
    Redo,
    X,
    Sparkles,
    Zap,
    Share2,
    Settings2,
    Layout,
    Eye
} from 'lucide-react';
import { type Survey, type SurveyElement, type SurveyQuestion, type SurveyResultPage, type School, type WorkspaceEntity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon } from '@/components/icons';
import { syncVariableRegistry } from '@/lib/messaging-actions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { prepareSurveyForFirestore, applySurveyDefaults } from '@/lib/firestore-utils';

// Extracted Modular Components
import Step1Details from '../components/step-1-details';
import SurveyFormBuilder from '../components/survey-form-builder';
import ResultsStep from '../components/results-step';
import Step4Publish from '../components/step-4-publish';
import LivePreviewPane from '../components/live-preview-pane';
import ValidationErrorModal, { type ValidationError } from '../components/validation-error-modal';
import AiChatEditor from '../components/ai-chat-editor';

const elementSchema = z.any();

const formSchema = z.object({
  internalName: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  elements: z.array(elementSchema).min(1, 'Survey must have at least one element.'),
  thankYouTitle: z.string().optional(),
  thankYouDescription: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  logoMode: z.enum(['organization', 'custom', 'placeholder']).optional(),
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  videoUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  videoThumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoCaption: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundPattern: z.enum(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).default('none'),
  patternColor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  slug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  webhookId: z.string().optional(),
  webhookEnabled: z.boolean().default(false),
  showDebugProcessingModal: z.boolean().default(false),
  scoringEnabled: z.boolean().default(false),
  scoreDisplayMode: z.enum(['points', 'percentage']).default('points'),
  maxScore: z.number().min(0).default(100),
  resultRules: z.array(z.any()).default([]),
  resultPages: z.array(z.any()).default([]),
  startButtonText: z.string().optional(),
  showCoverPage: z.boolean().default(true),
  showSurveyTitles: z.boolean().default(true),
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
  externalAlertsEnabled: z.boolean().default(false),
  externalAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  externalAlertContactTypes: z.array(z.string()).default([]),
  externalAlertEmailTemplateId: z.string().optional(),
  externalAlertSmsTemplateId: z.string().optional(),
  useEntityLogo: z.boolean().default(false),
  entityId: z.string().optional().nullable(),
  entityName: z.string().optional().nullable(),
  workspaceIds: z.array(z.string()).min(1, 'At least one workspace required.'),
});

type FormData = z.infer<typeof formSchema>;

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = [
        { n: 1, label: 'Details', icon: Settings2 },
        { n: 2, label: 'Builder', icon: Layout },
        { n: 3, label: 'Results', icon: Zap },
        { n: 4, label: 'Publish', icon: Share2 }
    ];

    return (
 <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const isActive = currentStep === step.n;
                const isCompleted = currentStep > step.n;
                const Icon = step.icon;

                return (
                    <React.Fragment key={step.label}>
                        <button 
                            type="button"
                            onClick={() => onStepClick(step.n)}
 className="flex flex-col items-center group outline-none"
                        >
                            <div
 className={cn(
                                    'flex items-center justify-center w-9 h-9 rounded-2xl border-2 transition-all duration-300 shadow-sm',
                                    isCompleted ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 
                                    isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-card border-border text-muted-foreground',
                                )}
                            >
 {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                            </div>
 <p className={cn(
                                'mt-3 text-[10px] font-semibold uppercase  transition-colors', 
                                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {step.label}
                            </p>
                        </button>
                        {index < steps.length - 1 && (
 <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden relative">
                                <motion.div 
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
 className="absolute inset-0 bg-primary"
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default function NewSurveyPage() {
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);
    const [mobileMode, setMobileMode] = React.useState<'edit' | 'preview'>('edit');

    const institutionsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId), orderBy('displayName', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: institutions } = useCollection<WorkspaceEntity>(institutionsQuery);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            internalName: '',
            title: '',
            description: '',
            status: 'draft',
            workspaceIds: [activeWorkspaceId],
            elements: [
                {
                    id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'section',
                    title: 'Section 1',
                    description: '',
                    renderAsPage: false,
                    hidden: false,
                } as any,
            ],
            thankYouTitle: 'Thank You!',
            thankYouDescription: 'Your response has been recorded.',
            logoUrl: '',
            logoMode: 'organization',
            bannerImageUrl: '',
            videoUrl: '',
            videoThumbnailUrl: '',
            videoCaption: '',
            backgroundColor: '#F1F5F9',
            backgroundPattern: 'none',
            patternColor: '#3B5FFF',
            slug: '',
            webhookId: '',
            webhookEnabled: false,
            showDebugProcessingModal: false,
            scoringEnabled: false,
            scoreDisplayMode: 'points',
            maxScore: 100,
            resultRules: [],
            resultPages: [],
            startButtonText: 'Let\'s Start',
            showCoverPage: true,
            showSurveyTitles: true,
            adminAlertsEnabled: false,
            adminAlertChannel: 'both',
            adminAlertNotifyManager: false,
            adminAlertSpecificUserIds: [],
            externalAlertsEnabled: false,
            externalAlertChannel: 'both',
            externalAlertContactTypes: [],
            useEntityLogo: false,
        },
    });

    const { getValues, setValue, watch, trigger, reset } = form;

    const {
        state: historyState,
        set: setHistory,
        undo: undoHistory,
        redo: redoHistory,
        canUndo,
        canRedo,
        reset: resetHistory
    } = useUndoRedo<any>([]);

    const isProgrammaticChange = React.useRef(false);
    const debouncedFields = useDebounce(watch('elements'), 800);

    React.useEffect(() => {
        resetHistory(getValues('elements'));
    }, [getValues, resetHistory]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) return;
        setHistory(debouncedFields);
    }, [debouncedFields, setHistory]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            setValue('elements', historyState, { shouldDirty: true });
            isProgrammaticChange.current = false;
        }
    }, [historyState, setValue]);

    const onSubmit = async (data: FormData) => {
        setIsSaving(true);
        setValidationErrors([]);
        
        try {
            // First, check for missing required fields
            const requiredFieldErrors = validateRequiredFields(data);
            if (requiredFieldErrors.length > 0) {
                setValidationErrors(requiredFieldErrors);
                setIsErrorModalOpen(true);
                
                // Create a summary of missing required fields
                const missingFieldNames = requiredFieldErrors.map(error => {
                    switch (error.field) {
                        case 'internalName': return 'Internal Name';
                        case 'title': return 'Survey Title';
                        case 'description': return 'Survey Description';
                        case 'elements': return 'Survey Questions/Sections';
                        case 'slug': return 'URL Slug';
                        case 'workspaceIds': return 'Workspace Assignment';
                        default: return error.field;
                    }
                });
                
                const uniqueFields = [...new Set(missingFieldNames)];
                const fieldsList = uniqueFields.length > 1 
                    ? `${uniqueFields.slice(0, -1).join(', ')} and ${uniqueFields[uniqueFields.length - 1]}`
                    : uniqueFields[0];
                
                // Show detailed guidance for multiple missing fields
                const detailedMessage = requiredFieldErrors.length > 2 
                    ? `Please complete these ${requiredFieldErrors.length} required fields: ${fieldsList}. Each field is essential for creating a functional survey.`
                    : `Please complete the following required field${uniqueFields.length !== 1 ? 's' : ''}: ${fieldsList}`;
                
                toast({ 
                    variant: 'destructive', 
                    title: 'Required Fields Missing', 
                    description: detailedMessage
                });
                return;
            }
            
            // Then validate the form schema
            const validationResult = formSchema.safeParse(data);
            if (!validationResult.success) {
                const errors: ValidationError[] = [];
                validationResult.error.errors.forEach((error) => {
                    const fieldPath = error.path.join('.');
                    const fieldName = error.path[error.path.length - 1];
                    
                    errors.push({
                        elementId: `field-${fieldPath}`,
                        blockTitle: getFieldDisplayName(fieldPath),
                        field: String(fieldName),
                        message: error.message
                    });
                });
                
                setValidationErrors(errors);
                setIsErrorModalOpen(true);
                toast({ 
                    variant: 'destructive', 
                    title: 'Validation Failed', 
                    description: `Found ${errors.length} validation error${errors.length !== 1 ? 's' : ''} that need to be fixed.` 
                });
                return;
            }
            
            // Finally, validate survey elements structure
            const elementErrors = validateSurveyElements(data.elements);
            if (elementErrors.length > 0) {
                setValidationErrors(elementErrors);
                setIsErrorModalOpen(true);
                
                // Count different types of element errors
                const elementIssues = elementErrors.reduce((acc, error) => {
                    if (error.blockTitle.includes('Element') || error.blockTitle.includes('Question')) {
                        acc.elements++;
                    }
                    return acc;
                }, { elements: 0 });
                
                toast({ 
                    variant: 'destructive', 
                    title: 'Survey Structure Issues', 
                    description: `Found ${elementErrors.length} issue${elementErrors.length !== 1 ? 's' : ''} in your survey elements that need to be resolved.` 
                });
                return;
            }

            const { resultPages, ...mainData } = data;
            
            // Apply defaults and clean the data for Firestore
            const dataWithDefaults = applySurveyDefaults(mainData);
            const cleanedData = prepareSurveyForFirestore(dataWithDefaults, false);
            
            // Debug log to help identify problematic fields
            console.log('Survey data being saved:', {
                originalFieldCount: Object.keys(mainData).length,
                cleanedFieldCount: Object.keys(cleanedData).length,
                hasResultPages: !!(resultPages && resultPages.length > 0)
            });
            
            const surveyRef = await addDoc(collection(firestore!, 'surveys'), cleanedData);
            
            if (resultPages && resultPages.length > 0) {
                const pagesCol = collection(firestore!, `surveys/${surveyRef.id}/resultPages`);
                for (const page of resultPages) {
                    const cleanedPage = prepareSurveyForFirestore(page, false);
                    await setDoc(doc(pagesCol, page.id), cleanedPage);
                }
            }

            toast({ title: 'Survey Created Successfully' });
            if (data.status === 'published') {
                syncVariableRegistry().catch(console.error);
            }
            router.push('/admin/surveys');
        } catch (error: any) {
            console.error('Survey creation error:', error);
            
            // Parse Firebase/Firestore errors for better user feedback
            let errorMessage = 'An unexpected error occurred while saving the survey.';
            let errorDetails = '';
            
            if (error.code) {
                switch (error.code) {
                    case 'permission-denied':
                        errorMessage = 'Permission denied. You don\'t have access to create surveys.';
                        errorDetails = 'Please check your workspace permissions or contact an administrator.';
                        break;
                    case 'invalid-argument':
                        if (error.message && error.message.includes('undefined')) {
                            errorMessage = 'Invalid survey data: some fields contain undefined values.';
                            errorDetails = 'This is usually caused by incomplete form data. Please ensure all fields are properly filled.';
                        } else {
                            errorMessage = 'Invalid survey data provided.';
                            errorDetails = 'Please check all required fields are filled correctly.';
                        }
                        break;
                    case 'failed-precondition':
                        errorMessage = 'Survey creation failed due to a system constraint.';
                        errorDetails = 'This might be due to duplicate slug or missing workspace configuration.';
                        break;
                    case 'resource-exhausted':
                        errorMessage = 'System is currently overloaded.';
                        errorDetails = 'Please try again in a few moments.';
                        break;
                    case 'unauthenticated':
                        errorMessage = 'Authentication required.';
                        errorDetails = 'Please log in again and try creating the survey.';
                        break;
                    default:
                        errorMessage = `System error: ${error.code}`;
                        errorDetails = error.message || 'Please try again or contact support if the issue persists.';
                }
            } else if (error.message) {
                if (error.message.includes('undefined')) {
                    errorMessage = 'Survey data contains invalid undefined values.';
                    errorDetails = 'Some form fields were not properly initialized. Please refresh the page and try again.';
                } else if (error.message.includes('slug')) {
                    errorMessage = 'Survey URL slug is already in use.';
                    errorDetails = 'Please modify the survey title or manually set a unique slug.';
                } else if (error.message.includes('workspace')) {
                    errorMessage = 'Workspace configuration error.';
                    errorDetails = 'Please ensure you have access to the selected workspace.';
                } else if (error.message.includes('network')) {
                    errorMessage = 'Network connection error.';
                    errorDetails = 'Please check your internet connection and try again.';
                } else {
                    errorDetails = error.message;
                }
            }
            
            toast({ 
                variant: 'destructive', 
                title: errorMessage,
                description: errorDetails
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Helper function to get a comprehensive list of all required fields by step
    const getRequiredFieldsByStep = () => {
        return {
            1: [
                { field: 'internalName', label: 'Internal Name', description: 'Used for internal organization (min 2 characters)' },
                { field: 'title', label: 'Survey Title', description: 'Public title shown to respondents (min 5 characters)' },
                { field: 'description', label: 'Survey Description', description: 'Brief description of the survey purpose (min 10 characters)' }
            ],
            2: [
                { field: 'elements', label: 'Survey Elements', description: 'At least one question or section must be added' }
            ],
            3: [
                // Results step doesn't have strict required fields
            ],
            4: [
                { field: 'slug', label: 'URL Slug', description: 'Unique identifier for the survey URL (min 3 characters, lowercase letters, numbers, and hyphens only)' },
                { field: 'workspaceIds', label: 'Workspace Assignment', description: 'At least one workspace must be selected for the survey' }
            ]
        };
    };

    // Helper function to check for missing required fields and provide specific guidance
    const validateRequiredFields = (data: FormData): ValidationError[] => {
        const errors: ValidationError[] = [];
        const missingFields: string[] = [];
        
        // Check required fields based on schema
        if (!data.internalName || data.internalName.trim().length < 2) {
            missingFields.push('Internal Name');
            errors.push({
                elementId: 'field-internalName',
                blockTitle: 'Survey Details',
                field: 'internalName',
                message: 'Internal name is required and must be at least 2 characters'
            });
        }
        
        if (!data.title || data.title.trim().length < 5) {
            missingFields.push('Survey Title');
            errors.push({
                elementId: 'field-title',
                blockTitle: 'Survey Details',
                field: 'title',
                message: 'Survey title is required and must be at least 5 characters'
            });
        }
        
        if (!data.description || data.description.trim().length < 10) {
            missingFields.push('Survey Description');
            errors.push({
                elementId: 'field-description',
                blockTitle: 'Survey Details',
                field: 'description',
                message: 'Survey description is required and must be at least 10 characters'
            });
        }
        
        if (!data.elements || data.elements.length === 0) {
            missingFields.push('Survey Elements');
            errors.push({
                elementId: 'field-elements',
                blockTitle: 'Survey Builder',
                field: 'elements',
                message: 'Survey must have at least one element (question or section)'
            });
        }
        
        if (!data.slug || data.slug.trim().length < 3) {
            missingFields.push('URL Slug');
            errors.push({
                elementId: 'field-slug',
                blockTitle: 'Publishing Settings',
                field: 'slug',
                message: 'URL slug is required and must be at least 3 characters'
            });
        } else if (!/^[a-z0-9-]+$/.test(data.slug)) {
            errors.push({
                elementId: 'field-slug',
                blockTitle: 'Publishing Settings',
                field: 'slug',
                message: 'URL slug can only contain lowercase letters, numbers, and hyphens'
            });
        }
        
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            missingFields.push('Workspace Assignment');
            errors.push({
                elementId: 'field-workspaceIds',
                blockTitle: 'Publishing Settings',
                field: 'workspaceIds',
                message: 'At least one workspace must be selected'
            });
        }
        
        // Check URL fields for valid format if provided
        if (data.logoUrl && data.logoUrl.trim() !== '' && !isValidUrl(data.logoUrl)) {
            errors.push({
                elementId: 'field-logoUrl',
                blockTitle: 'Media & Styling',
                field: 'logoUrl',
                message: 'Logo URL must be a valid URL format'
            });
        }
        
        if (data.bannerImageUrl && data.bannerImageUrl.trim() !== '' && !isValidUrl(data.bannerImageUrl)) {
            errors.push({
                elementId: 'field-bannerImageUrl',
                blockTitle: 'Media & Styling',
                field: 'bannerImageUrl',
                message: 'Banner image URL must be a valid URL format'
            });
        }
        
        if (data.videoUrl && data.videoUrl.trim() !== '' && !isValidUrl(data.videoUrl)) {
            errors.push({
                elementId: 'field-videoUrl',
                blockTitle: 'Media & Styling',
                field: 'videoUrl',
                message: 'Video URL must be a valid URL format'
            });
        }
        
        return errors;
    };
    
    // Helper function to validate URL format
    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    // Helper function to validate survey elements and provide specific errors
    const validateSurveyElements = (elements: any[]): ValidationError[] => {
        const errors: ValidationError[] = [];
        const missingElementFields: string[] = [];
        
        if (!elements || elements.length === 0) {
            errors.push({
                elementId: 'elements-empty',
                blockTitle: 'Survey Builder',
                field: 'elements',
                message: 'Survey must have at least one element (question or section). Please add a question or section to continue.'
            });
            return errors;
        }
        
        elements.forEach((element, index) => {
            const elementNumber = index + 1;
            const elementMissingFields: string[] = [];
            
            if (!element.type) {
                elementMissingFields.push('Element Type');
                errors.push({
                    elementId: `element-${index}-type`,
                    blockTitle: `Element ${elementNumber}`,
                    field: 'type',
                    message: 'Element type is required (question, section, or layout)'
                });
            }
            
            if (!element.title || element.title.trim().length === 0) {
                elementMissingFields.push('Title');
                errors.push({
                    elementId: `element-${index}-title`,
                    blockTitle: `Element ${elementNumber}`,
                    field: 'title',
                    message: 'Element title is required and cannot be empty'
                });
            }
            
            // Validate question-specific required fields
            if (element.type === 'question') {
                if (!element.questionType) {
                    elementMissingFields.push('Question Type');
                    errors.push({
                        elementId: `element-${index}-questionType`,
                        blockTitle: `Question ${elementNumber}`,
                        field: 'questionType',
                        message: 'Question type is required (text, single_choice, multiple_choice, etc.)'
                    });
                }
                
                // Validate choice questions
                if (['single_choice', 'multiple_choice', 'dropdown'].includes(element.questionType)) {
                    if (!element.choices || element.choices.length === 0) {
                        elementMissingFields.push('Answer Choices');
                        errors.push({
                            elementId: `element-${index}-choices`,
                            blockTitle: `Question ${elementNumber}`,
                            field: 'choices',
                            message: 'Choice questions must have at least one answer option'
                        });
                    } else {
                        const emptyChoices: number[] = [];
                        element.choices.forEach((choice: any, choiceIndex: number) => {
                            if (!choice.text || choice.text.trim().length === 0) {
                                emptyChoices.push(choiceIndex + 1);
                                errors.push({
                                    elementId: `element-${index}-choice-${choiceIndex}`,
                                    blockTitle: `Question ${elementNumber}`,
                                    field: `choice ${choiceIndex + 1}`,
                                    message: 'Choice text cannot be empty'
                                });
                            }
                        });
                        
                        if (emptyChoices.length > 0) {
                            elementMissingFields.push(`Choice Text (options ${emptyChoices.join(', ')})`);
                        }
                    }
                }
                
                // Validate rating questions
                if (element.questionType === 'rating') {
                    if (!element.ratingScale || element.ratingScale < 2) {
                        elementMissingFields.push('Rating Scale');
                        errors.push({
                            elementId: `element-${index}-ratingScale`,
                            blockTitle: `Question ${elementNumber}`,
                            field: 'ratingScale',
                            message: 'Rating scale must be at least 2 (minimum and maximum values)'
                        });
                    }
                    
                    if (!element.ratingLabels || !element.ratingLabels.min || !element.ratingLabels.max) {
                        elementMissingFields.push('Rating Labels');
                        errors.push({
                            elementId: `element-${index}-ratingLabels`,
                            blockTitle: `Question ${elementNumber}`,
                            field: 'ratingLabels',
                            message: 'Rating questions require minimum and maximum labels'
                        });
                    }
                }
                
                // Validate file upload questions
                if (element.questionType === 'file_upload') {
                    if (!element.acceptedFileTypes || element.acceptedFileTypes.length === 0) {
                        elementMissingFields.push('Accepted File Types');
                        errors.push({
                            elementId: `element-${index}-fileTypes`,
                            blockTitle: `Question ${elementNumber}`,
                            field: 'acceptedFileTypes',
                            message: 'File upload questions must specify accepted file types'
                        });
                    }
                }
                
                // Add summary error for elements with multiple missing fields
                if (elementMissingFields.length > 1) {
                    missingElementFields.push(`Element ${elementNumber}: ${elementMissingFields.join(', ')}`);
                }
            }
        });
        
        return errors;
    };

    // Helper function to get user-friendly field names
    const getFieldDisplayName = (fieldPath: string): string => {
        const fieldMap: Record<string, string> = {
            'internalName': 'Survey Details',
            'title': 'Survey Details',
            'description': 'Survey Details',
            'slug': 'Survey Details',
            'elements': 'Survey Builder',
            'logoUrl': 'Media & Styling',
            'bannerImageUrl': 'Media & Styling',
            'videoUrl': 'Media & Styling',
            'videoCaption': 'Media & Styling',
            'backgroundColor': 'Media & Styling',
            'backgroundPattern': 'Media & Styling',
            'patternColor': 'Media & Styling',
            'resultRules': 'Results Configuration',
            'resultPages': 'Results Configuration',
            'workspaceIds': 'Publishing Settings',
            'webhookId': 'Publishing Settings',
            'adminAlertEmailTemplateId': 'Alert Settings',
            'adminAlertSmsTemplateId': 'Alert Settings',
            'externalAlertEmailTemplateId': 'Alert Settings',
            'externalAlertSmsTemplateId': 'Alert Settings'
        };
        
        // Check for nested paths (e.g., elements.0.title)
        const topLevelField = fieldPath.split('.')[0];
        return fieldMap[topLevelField] || fieldMap[fieldPath] || 'Survey Configuration';
    };

    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['internalName', 'title', 'description', 'videoUrl', 'videoCaption', 'logoUrl', 'bannerImageUrl'];
        if (step === 2) fieldsToValidate = ['elements'];
        if (step === 3) fieldsToValidate = ['resultRules', 'resultPages'];
        
        const isStepValid = await trigger(fieldsToValidate);
        if (!isStepValid) {
            // Get specific validation errors for this step
            const formErrors = form.formState.errors;
            const stepErrors: ValidationError[] = [];
            const missingRequiredFields: string[] = [];
            
            // Check for required field errors in current step
            if (step === 1) {
                const currentData = getValues();
                const requiredFieldErrors = validateRequiredFields(currentData);
                const step1RequiredErrors = requiredFieldErrors.filter(error => 
                    ['internalName', 'title', 'description'].includes(error.field)
                );
                stepErrors.push(...step1RequiredErrors);
                
                step1RequiredErrors.forEach(error => {
                    switch (error.field) {
                        case 'internalName': missingRequiredFields.push('Internal Name'); break;
                        case 'title': missingRequiredFields.push('Survey Title'); break;
                        case 'description': missingRequiredFields.push('Survey Description'); break;
                    }
                });
            }
            
            fieldsToValidate.forEach(field => {
                const typedField = field as keyof typeof formErrors;
                if (formErrors[typedField]) {
                    const error = formErrors[typedField];
                    stepErrors.push({
                        elementId: `field-${field}`,
                        blockTitle: getFieldDisplayName(field),
                        field: field,
                        message: (error as any)?.message || 'This field is required'
                    });
                }
            });
            
            // Check for nested errors in elements
            if (fieldsToValidate.includes('elements') && formErrors.elements) {
                const elementsErrors = formErrors.elements as any;
                if (Array.isArray(elementsErrors)) {
                    elementsErrors.forEach((elementError, index) => {
                        if (elementError) {
                            Object.keys(elementError).forEach(fieldName => {
                                stepErrors.push({
                                    elementId: `element-${index}-${fieldName}`,
                                    blockTitle: `Element ${index + 1}`,
                                    field: fieldName,
                                    message: elementError[fieldName]?.message || 'Invalid value'
                                });
                            });
                        }
                    });
                }
            }
            
            // Additional validation for survey elements if we're on step 2
            if (step === 2) {
                const elementValidationErrors = validateSurveyElements(getValues('elements'));
                stepErrors.push(...elementValidationErrors);
            }
            
            if (stepErrors.length > 0) {
                setValidationErrors(stepErrors);
                setIsErrorModalOpen(true);
            }
            
            // Create specific error message based on what's missing
            let errorMessage = '';
            if (missingRequiredFields.length > 0) {
                const fieldsList = missingRequiredFields.length > 1 
                    ? `${missingRequiredFields.slice(0, -1).join(', ')} and ${missingRequiredFields[missingRequiredFields.length - 1]}`
                    : missingRequiredFields[0];
                errorMessage = `Please complete these required fields: ${fieldsList}`;
            } else {
                errorMessage = `Please fix ${stepErrors.length || 'the'} error${stepErrors.length !== 1 ? 's' : ''} in this step before proceeding.`;
            }
            
            toast({ 
                variant: 'destructive', 
                title: 'Cannot Proceed to Next Step', 
                description: errorMessage
            });
            return;
        }

        if (step === 1) {
            const title = getValues('title');
            if (title && !getValues('slug')) {
                const slug = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                setValue('slug', slug, { shouldValidate: true });
            }
        }

        setStep(s => s + 1);
    };

    const handleStepChange = async (target: number) => {
        if (target === step) return;
        if (target > step) {
            // Validate current step before moving forward
            let fieldsToValidate: any[] = [];
            if (step === 1) fieldsToValidate = ['internalName', 'title', 'description', 'videoUrl', 'videoCaption', 'logoUrl', 'bannerImageUrl'];
            if (step === 2) fieldsToValidate = ['elements'];
            if (step === 3) fieldsToValidate = ['resultRules', 'resultPages'];
            
            const isStepValid = await trigger(fieldsToValidate);
            if (!isStepValid) {
                // Get specific validation errors
                const formErrors = form.formState.errors;
                const stepErrors: ValidationError[] = [];
                const missingRequiredFields: string[] = [];
                
                // Check for required field errors in current step
                if (step === 1) {
                    const currentData = getValues();
                    const requiredFieldErrors = validateRequiredFields(currentData);
                    const step1RequiredErrors = requiredFieldErrors.filter(error => 
                        ['internalName', 'title', 'description'].includes(error.field)
                    );
                    stepErrors.push(...step1RequiredErrors);
                    
                    step1RequiredErrors.forEach(error => {
                        switch (error.field) {
                            case 'internalName': missingRequiredFields.push('Internal Name'); break;
                            case 'title': missingRequiredFields.push('Survey Title'); break;
                            case 'description': missingRequiredFields.push('Survey Description'); break;
                        }
                    });
                }
                
                fieldsToValidate.forEach(field => {
                    const typedField = field as keyof typeof formErrors;
                    if (formErrors[typedField]) {
                        const error = formErrors[typedField];
                        stepErrors.push({
                            elementId: `field-${field}`,
                            blockTitle: getFieldDisplayName(field),
                            field: field,
                            message: (error as any)?.message || 'This field is required'
                        });
                    }
                });
                
                // Additional validation for survey elements if we're on step 2
                if (step === 2) {
                    const elementValidationErrors = validateSurveyElements(getValues('elements'));
                    stepErrors.push(...elementValidationErrors);
                }
                
                if (stepErrors.length > 0) {
                    setValidationErrors(stepErrors);
                    setIsErrorModalOpen(true);
                    
                    // Create specific error message
                    let errorMessage = '';
                    if (missingRequiredFields.length > 0) {
                        const fieldsList = missingRequiredFields.length > 1 
                            ? `${missingRequiredFields.slice(0, -1).join(', ')} and ${missingRequiredFields[missingRequiredFields.length - 1]}`
                            : missingRequiredFields[0];
                        errorMessage = `Please complete these required fields in step ${step}: ${fieldsList}`;
                    } else {
                        errorMessage = `Please fix the errors in step ${step} before proceeding.`;
                    }
                    
                    toast({ 
                        variant: 'destructive', 
                        title: 'Cannot proceed', 
                        description: errorMessage
                    });
                    return;
                }
            }
        }
        setStep(target);
    };

    const handleUndo = () => { if (canUndo) { isProgrammaticChange.current = true; undoHistory(); } };
    const handleRedo = () => { if (canRedo) { isProgrammaticChange.current = true; redoHistory(); } };

    return (
        <FormProvider {...form}>
 <div className="h-full flex flex-col">
 <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-4 text-left">
 <div className="p-2 bg-primary/10 rounded-xl">
 <SmartSappIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
 <h1 className="font-semibold text-sm tracking-tight leading-none mb-1">
                                New Survey Blueprint
                            </h1>
 <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] h-4 font-semibold uppercase border-primary/20 text-primary bg-primary/5">Creation Mode</Badge>
                            </div>
                        </div>
                    </div>

 <div className="flex items-center gap-3">
                        {step === 2 && (
 <div className="flex items-center gap-1 mr-4 bg-card/20 p-1 rounded-xl border border-border/50">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleUndo} disabled={!canUndo}><Undo className="h-4 w-4" /></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Undo</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleRedo} disabled={!canRedo}><Redo className="h-4 w-4" /></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Redo</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
 <AiChatEditor className="h-9" />
                    </div>
                </header>

 <div className="flex-1 overflow-y-auto ">
 <div className="">
                        <Stepper currentStep={step} onStepClick={handleStepChange} />

                        <AnimatePresence mode="wait">
                            {step === 1 && (
 <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
 <div className="md:hidden flex justify-center mb-6">
 <div className="bg-card border shadow-sm p-1 rounded-2xl flex gap-1 ring-1 ring-border">
 <Button variant={mobileMode === 'edit' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileMode('edit')} className="rounded-xl font-semibold text-[10px] h-10 px-6">Configure</Button>
 <Button variant={mobileMode === 'preview' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileMode('preview')} className="rounded-xl font-semibold text-[10px] h-10 px-6">Live View</Button>
                                        </div>
                                    </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
 <div className={cn("space-y-8", mobileMode === 'preview' && "hidden md:block")}>
                                            <Step1Details institutions={institutions || []} />
                                        </div>
 <div className={cn("sticky top-0 h-[calc(100vh-250px)]", mobileMode === 'edit' && "hidden md:block")}>
                                            <LivePreviewPane />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <SurveyFormBuilder />
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <ResultsStep />
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <Step4Publish />
                                </motion.div>
                            )}
                        </AnimatePresence>

 <div className="mt-8 p-4 sm:p-6 bg-card border-t border-border/50 rounded-t-[2.5rem] shadow-[0_-12px_40px_-5px_rgba(0,0,0,0.05)]">
 <div className=" flex items-center justify-between text-left">
 <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')} className="font-bold text-muted-foreground rounded-xl px-6 h-12">Cancel</Button>
 <div className="flex items-center gap-4 text-left">
 {step > 1 && <Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>}
                                    {step < 4 ? (
 <Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-semibold shadow-xl rounded-xl transition-all active:scale-95 group">
 Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    ) : (
 <Button type="submit" disabled={isSaving} onClick={form.handleSubmit(onSubmit)} className="gap-2 px-12 h-14 font-semibold shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">
 {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-4 w-4" />} 
                                            Finalize & Initialize
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <ValidationErrorModal open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen} errors={validationErrors} onFix={(id) => { setIsErrorModalOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }} />
            </div>
        </FormProvider>
    );
}
