
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, isAfter, startOfToday } from 'date-fns';

// --- SEED DATA ---

const mediaData: Omit<MediaAsset, 'id'>[] = [
  {
    name: 'smartsapp-logo.png',
    url: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    originalName: 'smartsapp-logo.png',
    fullPath: 'seed/smartsapp-logo.png',
    type: 'image', mimeType: 'image/png', size: 15000, width: 256, height: 256,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
  {
    name: 'school-campus-hero.jpg',
    url: 'https://picsum.photos/seed/school-hero/1200/800',
    originalName: 'school-campus-hero.jpg',
    fullPath: 'seed/school-campus-hero.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 250000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:01:00Z').toISOString(),
  },
  {
    name: 'school-prospectus.pdf',
    url: 'https://smartsapp.com/downloads/brochure.pdf',
    originalName: 'school-prospectus.pdf',
    fullPath: 'seed/school-prospectus.pdf',
    type: 'document', mimeType: 'application/pdf', size: 1200000,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T11:00:00Z').toISOString(),
  },
  {
    name: 'promotional-video.mp4',
    url: 'https://youtu.be/M6MUlDkfZOg',
    originalName: 'promotional-video.mp4',
    type: 'link', size: 0,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T12:00:00Z').toISOString(),
  },
  {
    name: 'students-in-classroom.jpg',
    url: 'https://picsum.photos/seed/classroom/1200/800',
    originalName: 'students-in-classroom.jpg',
    fullPath: 'seed/students-in-classroom.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 310000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-03T09:00:00Z').toISOString(),
  },
   {
    name: 'school-event.jpg',
    url: 'https://picsum.photos/seed/school-event/1200/800',
    originalName: 'school-event.jpg',
    fullPath: 'seed/school-event.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 450000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-04T14:00:00Z').toISOString(),
  },
];

const baseSchoolData: Omit<School, 'id' | 'slug' | 'stage' | 'assignedTo' | 'createdAt' | 'logoUrl' | 'heroImageUrl' | 'modules'>[] = [
  { name: 'Ghana International School', slogan: 'Understanding of each other.', location: 'Accra, Ghana', nominalRoll: 1500, includeDroneFootage: true, referee: 'SmartSapp Team', contactPerson: 'Dr. Mary Ashun', email: 'principal@gis.edu.gh', phone: '+233 30 277 7163' },
  { name: 'Lincoln Community School', slogan: 'Learning and community, hand in hand.', location: 'Accra, Ghana', nominalRoll: 800, includeDroneFootage: false, referee: 'Ama Serwaa', contactPerson: 'John Smith', email: 'admissions@lincoln.edu.gh', phone: '+233 30 221 8100' },
  { name: 'Adisadel College', slogan: 'Vel Primus Vel Cum Primis.', location: 'Cape Coast, Ghana', nominalRoll: 2000, includeDroneFootage: true, referee: 'Old Boys Association', contactPerson: 'The Headmaster', email: 'info@adisadelcollege.net', phone: '+233 33 213 2543' },
  { name: 'SOS-Hermann Gmeiner International College', slogan: 'Knowledge and Service.', location: 'Tema, Ghana', nominalRoll: 400, includeDroneFootage: false, referee: 'SOS-CV Ghana', contactPerson: 'The Principal', email: 'hgic.info@sos-ghana.org', phone: '+233 30 330 5231' },
  { name: 'Wesley Girls\' High School', slogan: 'Live Pure, Speak True, Right Wrong, Follow the King.', location: 'Cape Coast, Ghana', nominalRoll: 1800, includeDroneFootage: false, referee: 'GES', contactPerson: 'The Headmistress', email: 'info@wesleygirls.edu.gh', phone: '+233 33 213 2218' },
  { name: 'Presbyterian Boys\' Secondary School (PRESEC)', slogan: 'In Lumine Tuo Videbimus Lumen.', location: 'Legon, Accra', nominalRoll: 2500, includeDroneFootage: true, referee: 'Old Boys Association', contactPerson: 'The Headmaster', email: 'info@preseclegon.edu.gh', phone: '+233 30 250 0907' },
  { name: 'Galaxy International School', slogan: 'Gateway to the Future.', location: 'Accra, Ghana', nominalRoll: 600, includeDroneFootage: true, referee: 'Corporate Referral', contactPerson: 'Admissions Office', email: 'info@galaxy.edu.gh', phone: '+233 30 254 5472' },
];

const surveyData: Omit<Survey, 'id' | 'createdAt' | 'updatedAt' | 'slug'>[] = [
  {
    title: 'Comprehensive Feedback Survey',
    description: 'Please provide your valuable feedback to help us improve our services. This survey includes examples of all available question and layout types.',
    status: 'published',
    thankYouTitle: 'Thank You for Your Feedback!',
    thankYouDescription: 'We have received your submission and will use it to improve our services.',
    bannerImageUrl: 'https://picsum.photos/seed/survey1-banner/1200/400',
    elements: [
      { id: 'sec_1', type: 'section', title: 'Personal Information', description: 'Let\'s start with some basic details.', renderAsPage: true, },
      { id: 'q_name', type: 'text', title: 'What is your full name?', isRequired: true, placeholder: 'e.g., Jane Doe', },
      { id: 'q_email', type: 'text', title: 'What is your email address?', isRequired: true, placeholder: 'e.g., jane.doe@example.com', },
      { id: 'layout_divider_1', type: 'divider', },
      { id: 'q_rating', type: 'rating', title: 'How would you rate your overall experience (1-5 stars)?', isRequired: true, defaultValue: 0, },
      { id: 'sec_2', type: 'section', title: 'Your Experience', description: 'Tell us more about your recent interaction.', renderAsPage: true, },
      { id: 'layout_heading_1', type: 'heading', title: 'Our Website', },
      { id: 'q_found_what_you_need', type: 'yes-no', title: 'Did you find what you were looking for on our website?', isRequired: true, },
      { id: 'logic_1', type: 'logic', rules: [{ sourceQuestionId: 'q_found_what_you_need', operator: 'isEqualTo', targetValue: 'No', action: { type: 'jump', targetElementId: 'sec_4_follow_up', }, },], },
      { id: 'sec_3_details', type: 'section', title: 'Further Details', description: 'This section will be skipped if you answered "No" above.', renderAsPage: false, },
      { id: 'q_which_products', type: 'checkboxes', title: 'Which of our products/services have you used? (Select all that apply)', isRequired: false, options: ['Product A', 'Service B', 'Consulting C'], allowOther: true, },
      { id: 'layout_video_1', type: 'video', url: 'https://youtu.be/M6MUlDkfZOg', },
      { id: 'sec_4_follow_up', type: 'section', title: 'Follow-Up', description: 'Thank you for your feedback. We appreciate your time.', renderAsPage: true, },
      { id: 'q_contact_permission', type: 'dropdown', title: 'May we contact you for a follow-up interview?', isRequired: false, options: ['Yes, by email', 'Yes, by phone', 'No, thank you'], },
    ],
  },
];

const defaultStages: Omit<OnboardingStage, 'id'>[] = [
    { name: 'Welcome', order: 1, color: ONBOARDING_STAGE_COLORS[0] },
    { name: 'Data Collection', order: 2, color: ONBOARDING_STAGE_COLORS[1] },
    { name: 'Setup', order: 3, color: ONBOARDING_STAGE_COLORS[2] },
    { name: 'Training', order: 4, color: ONBOARDING_STAGE_COLORS[3] },
    { name: 'Pre-Onboarding', order: 5, color: ONBOARDING_STAGE_COLORS[4] },
    { name: 'Parent Engagement', order: 6, color: ONBOARDING_STAGE_COLORS[5] },
    { name: 'Pre-Go-Live', order: 7, color: ONBOARDING_STAGE_COLORS[6] },
    { name: 'Go-Live', order: 8, color: ONBOARDING_STAGE_COLORS[7] },
    { name: 'Support', order: 9, color: ONBOARDING_STAGE_COLORS[8] },
];

const defaultModules: Omit<Module, 'id'>[] = [
    { name: 'Child Security', abbreviation: 'SEC', color: '#f72585', description: 'Ensures safe drop-off and pick-up of students.', order: 1 },
    { name: 'Connected Community', abbreviation: 'COM', color: '#b5179e', description: 'Enhances communication between school, teachers, and parents.', order: 2 },
    { name: 'Fee Collection', abbreviation: 'FEE', color: '#7209b7', description: 'Streamlines school fee payments and tracking.', order: 3 },
    { name: 'Traffic Management', abbreviation: 'TRF', color: '#560bad', description: 'Manages school traffic flow during peak hours.', order: 4 },
    { name: 'Academic Reports', abbreviation: 'REP', color: '#480ca8', description: 'Digital report cards and academic performance tracking.', order: 5 },
    { name: 'Homework Management', abbreviation: 'HW', color: '#3f37c9', description: 'Assign, submit, and track homework digitally.', order: 6 },
    { name: 'Canteen Management', abbreviation: 'CAN', color: '#4361ee', description: 'Cashless system for school canteen purchases.', order: 7 },
];


// --- UTILITY ---

async function clearCollection(firestore: Firestore, collectionPath: string) {
  const collectionRef = collection(firestore, collectionPath);
  const querySnapshot = await getDocs(collectionRef);
  if (querySnapshot.empty) return;
  const batch = writeBatch(firestore);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

// --- SEEDING FUNCTIONS ---

export async function seedModules(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'modules');
  const batch = writeBatch(firestore);
  const modulesCollection = collection(firestore, 'modules');
  defaultModules.forEach((moduleData) => {
    const docRef = doc(modulesCollection);
    batch.set(docRef, moduleData);
  });
  await batch.commit();
  return defaultModules.length;
}

export async function seedMedia(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'media');
  const batch = writeBatch(firestore);
  const mediaCollection = collection(firestore, 'media');
  mediaData.forEach((asset) => {
    const docRef = doc(mediaCollection);
    batch.set(docRef, asset);
  });
  await batch.commit();
  return mediaData.length;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    const schoolsCollection = collection(firestore, 'schools');
    const usersCollection = collection(firestore, 'users');
    
    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);

    const usersQuery = query(usersCollection, where('isAuthorized', '==', true));
    const usersSnapshot = await getDocs(usersQuery);
    const authorizedUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    
    const stagesQuery = query(collection(firestore, 'onboardingStages'), orderBy('order'));
    const stagesSnapshot = await getDocs(stagesQuery);
    const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as OnboardingStage));
    
    const modulesSnapshot = await getDocs(query(collection(firestore, 'modules'), orderBy('order')));
    const allModules = modulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));

    if (stages.length === 0) {
        console.warn("No onboarding stages found. Please seed stages first. Schools will be un-staged.");
    }

    baseSchoolData.forEach((schoolBase, index) => {
        const docRef = doc(schoolsCollection);
        const slug = schoolBase.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const schoolModulesForSchool = allModules.length > 0 
            ? [allModules[index % allModules.length], allModules[(index + 2) % allModules.length]] 
            : [];
        
        const school: Omit<School, 'id'> = {
            ...schoolBase,
            slug,
            logoUrl: `https://logo.clearbit.com/${slug}.com`,
            heroImageUrl: `https://picsum.photos/seed/${slug}/1200/800`,
            stage: stages.length > 0 ? stages[index % stages.length] : undefined,
            assignedTo: authorizedUsers.length > 0 
                ? {
                    userId: authorizedUsers[index % authorizedUsers.length].id,
                    name: authorizedUsers[index % authorizedUsers.length].name,
                    email: authorizedUsers[index % authorizedUsers.length].email,
                  }
                : { userId: null, name: null, email: null },
            createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(), // Stagger creation dates
            implementationDate: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
            modules: schoolModulesForSchool.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
        };
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return baseSchoolData.length;
}

export async function seedMeetings(firestore: Firestore): Promise<number> {
  const meetingsCollection = collection(firestore, 'meetings');
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);

  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  if (schoolsSnapshot.empty) {
    console.warn("Seeding meetings failed: No schools found. Please seed schools first.");
    return 0;
  }
  
  let meetingsCount = 0;
  schoolsSnapshot.forEach((schoolDoc, index) => {
    const school = { id: schoolDoc.id, ...schoolDoc.data() } as School;
    
    MEETING_TYPES.forEach((type, typeIndex) => {
        const docRef = doc(meetingsCollection);
        
        const daysInFuture = (index * 7) + (typeIndex * 2) + 1;
        const meetingDate = addDays(new Date(), daysInFuture);
        
        const meeting: Omit<Meeting, 'id'> = {
            schoolId: school.id,
            schoolName: school.name,
            schoolSlug: school.slug,
            type: type,
            meetingTime: meetingDate.toISOString(),
            meetingLink: `https://meet.google.com/${school.slug.substring(0,3)}-${type.slug.substring(0,3)}-${Math.random().toString(36).substring(2,5)}`,
            recordingUrl: type.id === 'parent' ? 'https://youtu.be/dQw4w9WgXcQ' : '',
            brochureUrl: type.id === 'parent' ? mediaData.find(m=>m.type==='document')?.url : '',
        };
        batch.set(docRef, meeting);
        meetingsCount++;
    });
  });

  await batch.commit();
  return meetingsCount;
}

export async function seedSurveys(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'surveys');
  const batch = writeBatch(firestore);
  const surveysCollection = collection(firestore, 'surveys');

  surveyData.forEach((survey) => {
    const docRef = doc(surveysCollection);
    const slug = survey.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const completeSurvey = {
      ...survey,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    batch.set(docRef, completeSurvey);
  });
  
  await batch.commit();
  return surveyData.length;
}

export async function seedUserAvatars(firestore: Firestore): Promise<number> {
  const usersCollection = collection(firestore, 'users');
  const querySnapshot = await getDocs(usersCollection);
  const batch = writeBatch(firestore);
  let updatedCount = 0;

  querySnapshot.forEach((docSnap) => {
    const user = docSnap.data() as UserProfile;
    // Only update if photoURL is missing
    if (!user.photoURL) {
      const seed = user.name ? user.name.replace(/\s+/g, '-').toLowerCase() : docSnap.id;
      const photoURL = `https://i.pravatar.cc/150?u=${seed}`;
      batch.update(docSnap.ref, { photoURL: photoURL });
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
  }
  return updatedCount;
}

export async function seedOnboardingStages(firestore: Firestore): Promise<{ stagesCreated: number, schoolsUpdated: number }> {
    const stagesCollection = collection(firestore, 'onboardingStages');
    const schoolsCollection = collection(firestore, 'schools');
    const batch = writeBatch(firestore);

    // 1. Clear existing stages
    const oldStagesSnapshot = await getDocs(stagesCollection);
    oldStagesSnapshot.forEach((doc) => batch.delete(doc.ref));

    // 2. Create new stages from default data
    const newStagesMap = new Map<string, OnboardingStage>();
    defaultStages.forEach((stageData) => {
        const id = stageData.name.toLowerCase().replace(/\s+/g, '-');
        const docRef = doc(stagesCollection, id);
        const newStage: OnboardingStage = { id, ...stageData };
        batch.set(docRef, stageData);
        newStagesMap.set(id, newStage);
    });
    
    // 3. Update schools with new stage data or move to Welcome
    const schoolsSnapshot = await getDocs(schoolsCollection);
    let schoolsUpdated = 0;
    const welcomeStage = newStagesMap.get('welcome');

    if (!welcomeStage) {
        throw new Error("Welcome stage not found in default seed data.");
    }

    schoolsSnapshot.forEach(schoolDoc => {
        const school = schoolDoc.data() as School;
        const currentStageId = school.stage?.id;
        
        let newStageData;

        if (currentStageId && newStagesMap.has(currentStageId)) {
            // Stage still exists, update the school's copy of it
            newStageData = newStagesMap.get(currentStageId);
        } else {
            // Stage was deleted or never existed, assign to Welcome
            newStageData = welcomeStage;
        }

        if (
            !school.stage ||
            school.stage.id !== newStageData!.id ||
            school.stage.name !== newStageData!.name ||
            school.stage.order !== newStageData!.order ||
            school.stage.color !== newStageData!.color
        ) {
            batch.update(schoolDoc.ref, { stage: { id: newStageData!.id, name: newStageData!.name, order: newStageData!.order, color: newStageData!.color } });
            schoolsUpdated++;
        }
    });
    
    await batch.commit();

    return { stagesCreated: defaultStages.length, schoolsUpdated };
}

    