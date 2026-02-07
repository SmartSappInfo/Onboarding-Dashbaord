
'use client';

import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage } from '@/lib/types';

// --- SEED DATA ---

const mediaData: Omit<MediaAsset, 'id'>[] = [
  {
    name: 'smartsapp-logo.png',
    url: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    fullPath: 'seed/smartsapp-logo.png',
    type: 'image',
    mimeType: 'image/png',
    size: 15000,
    uploadedBy: 'system-seed',
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
  {
    name: 'school-campus-hero.jpg',
    url: 'https://picsum.photos/seed/school-hero/1200/800',
    fullPath: 'seed/school-campus-hero.jpg',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 250000,
    uploadedBy: 'system-seed',
    createdAt: new Date('2024-01-01T10:01:00Z').toISOString(),
  },
];

const schoolData: Omit<School, 'id'>[] = [
  {
    name: 'Ghana International School',
    slug: 'ghana-international-school',
    slogan: 'Understanding of each other.',
    logoUrl: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    heroImageUrl: 'https://picsum.photos/seed/school-hero/1200/800',
    contactPerson: 'Dr. Mary Ashun',
    email: 'principal@gis.edu.gh',
    phone: '+233 30 277 7163',
    location: 'Accra, Ghana',
    nominalRoll: 1500,
    modules: 'Billing, SIS, Attendance',
    implementationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
    referee: 'SmartSapp Team',
    includeDroneFootage: true,
    stage: { id: 'welcome', name: 'Welcome', order: 1 },
  },
];

const meetingData: Omit<Meeting, 'id'>[] = [
  {
    schoolId: 'ghana-international-school',
    schoolName: 'Ghana International School',
    schoolSlug: 'ghana-international-school',
    meetingTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    meetingLink: 'https://meet.google.com/foo-bar-baz',
    type: { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
    recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
  },
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
      {
        id: 'sec_1',
        type: 'section',
        title: 'Personal Information',
        description: 'Let\'s start with some basic details.',
        renderAsPage: true,
      },
      {
        id: 'q_name',
        type: 'text',
        title: 'What is your full name?',
        isRequired: true,
        placeholder: 'e.g., Jane Doe',
      },
      {
        id: 'q_email',
        type: 'text',
        title: 'What is your email address?',
        isRequired: true,
        placeholder: 'e.g., jane.doe@example.com',
      },
      {
        id: 'layout_divider_1',
        type: 'divider',
      },
      {
        id: 'q_rating',
        type: 'rating',
        title: 'How would you rate your overall experience (1-5 stars)?',
        isRequired: true,
        defaultValue: 0,
      },
      {
        id: 'sec_2',
        type: 'section',
        title: 'Your Experience',
        description: 'Tell us more about your recent interaction.',
        renderAsPage: true,
      },
      {
        id: 'layout_heading_1',
        type: 'heading',
        title: 'Our Website',
      },
      {
        id: 'q_found_what_you_need',
        type: 'yes-no',
        title: 'Did you find what you were looking for on our website?',
        isRequired: true,
      },
      {
        id: 'logic_1',
        type: 'logic',
        rules: [
          {
            sourceQuestionId: 'q_found_what_you_need',
            operator: 'isEqualTo',
            targetValue: 'No',
            action: {
              type: 'jump',
              targetElementId: 'sec_4_follow_up',
            },
          },
        ],
      },
      {
        id: 'sec_3_details',
        type: 'section',
        title: 'Further Details',
        description: 'This section will be skipped if you answered "No" above.',
        renderAsPage: false,
      },
      {
        id: 'q_which_products',
        type: 'checkboxes',
        title: 'Which of our products/services have you used? (Select all that apply)',
        isRequired: false,
        options: ['Product A', 'Service B', 'Consulting C'],
        allowOther: true,
      },
      {
        id: 'layout_video_1',
        type: 'video',
        url: 'https://youtu.be/M6MUlDkfZOg',
      },
      {
        id: 'sec_4_follow_up',
        type: 'section',
        title: 'Follow-Up',
        description: 'Thank you for your feedback. We appreciate your time.',
        renderAsPage: true,
      },
      {
        id: 'q_contact_permission',
        type: 'dropdown',
        title: 'May we contact you for a follow-up interview?',
        isRequired: false,
        options: ['Yes, by email', 'Yes, by phone', 'No, thank you'],
      },
    ],
  },
  {
    title: 'Event Registration Form',
    description: 'Register for our upcoming annual tech conference. This form demonstrates conditional logic.',
    status: 'published',
    thankYouTitle: 'Registration Confirmed!',
    thankYouDescription: 'You are all set for the event. We look forward to seeing you there.',
    bannerImageUrl: 'https://picsum.photos/seed/survey2-banner/1200/400',
    elements: [
      {
        id: 'sec_event_details',
        type: 'section',
        title: 'Annual Tech Conference 2025',
        description: 'Please fill out your details to register.',
        renderAsPage: false,
      },
      {
        id: 'q_full_name',
        type: 'text',
        title: 'Full Name',
        isRequired: true,
        placeholder: 'Enter your full name',
      },
      {
        id: 'q_attendance_type',
        type: 'multiple-choice',
        title: 'How will you be attending?',
        isRequired: true,
        options: ['In-Person', 'Virtually'],
        defaultValue: 'In-Person',
      },
      {
        id: 'q_tshirt_size',
        type: 'dropdown',
        title: 'What is your T-shirt size?',
        isRequired: true,
        options: ['Small', 'Medium', 'Large', 'X-Large'],
      },
      {
        id: 'logic_hide_tshirt',
        type: 'logic',
        rules: [
          {
            sourceQuestionId: 'q_attendance_type',
            operator: 'isEqualTo',
            targetValue: 'Virtually',
            action: {
              type: 'hide',
              targetElementIds: ['q_tshirt_size'],
            },
          },
        ],
      },
       {
        id: 'sec_confirmation',
        type: 'section',
        title: 'Confirmation',
        renderAsPage: false,
      },
       {
        id: 'q_agree_terms',
        type: 'yes-no',
        title: 'Do you agree to our terms and conditions?',
        isRequired: true,
      },
      {
        id: 'logic_disable_submit',
        type: 'logic',
        rules: [
          {
            sourceQuestionId: 'q_agree_terms',
            operator: 'isNotEqualTo',
            targetValue: 'Yes',
            action: {
              type: 'disableSubmit',
            },
          },
        ],
      },
    ],
  },
];

const defaultStages: Omit<OnboardingStage, 'id'>[] = [
    { name: 'Welcome', order: 1 },
    { name: 'Data Collection', order: 2 },
    { name: 'Setup', order: 3 },
    { name: 'Training', order: 4 },
    { name: 'Pre-Onboarding', order: 5 },
    { name: 'Parent Engagement', order: 6 },
    { name: 'Pre-Go-Live', order: 7 },
    { name: 'Go-Live', order: 8 },
    { name: 'Support', order: 9 },
];

// --- SEEDING FUNCTIONS ---

async function clearCollection(firestore: Firestore, collectionPath: string) {
  const collectionRef = collection(firestore, collectionPath);
  const querySnapshot = await getDocs(collectionRef);
  const batch = writeBatch(firestore);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
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
    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);
    const schoolsCollection = collection(firestore, 'schools');

    schoolData.forEach((school) => {
        const docRef = doc(schoolsCollection);
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return schoolData.length;
}


export async function seedMeetings(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);
  const meetingsCollection = collection(firestore, 'meetings');
  
  const updatedMeetingData = meetingData.map(m => ({ ...m, schoolId: m.schoolSlug }));

  updatedMeetingData.forEach((meeting) => {
    const docRef = doc(meetingsCollection);
    batch.set(docRef, meeting);
  });
  await batch.commit();
  return updatedMeetingData.length;
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
    const stagesSnapshot = await getDocs(stagesCollection);
    const batch = writeBatch(firestore);
    let stagesCreated = 0;

    if (stagesSnapshot.empty) {
        defaultStages.forEach((stage) => {
            const id = stage.name.toLowerCase().replace(/\s+/g, '-');
            const docRef = doc(stagesCollection, id);
            batch.set(docRef, stage);
        });
        stagesCreated = defaultStages.length;
    }

    const schoolsCollection = collection(firestore, 'schools');
    const schoolsSnapshot = await getDocs(schoolsCollection);
    let schoolsUpdated = 0;
    const welcomeStage = defaultStages.find(s => s.order === 1) || { id: 'welcome', name: 'Welcome', order: 1 };

    schoolsSnapshot.forEach(schoolDoc => {
        const school = schoolDoc.data() as School;
        if (!school.stage) {
            batch.update(schoolDoc.ref, { stage: { id: welcomeStage.id, name: welcomeStage.name, order: welcomeStage.order } });
            schoolsUpdated++;
        }
    });
    
    if (stagesCreated > 0 || schoolsUpdated > 0) {
        await batch.commit();
    }

    return { stagesCreated, schoolsUpdated };
}
