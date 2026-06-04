# Facilitator Waiting Room Profile Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow facilitators to verify and customize their name, bio, and profile picture in a two-column layout prior to entering a meeting, with updates applied inside the current meeting document only, and with no time constraints or auto-redirection.

**Architecture:** We will implement a new server action `updateMeetingFacilitatorAction` to write facilitator updates back to the meeting doc in Firestore, and a separate `logFacilitatorAttendance` server action to write presence info into the `attendees` collection without attempting to touch the registrant collection. Then, we will adapt `JoiningPageClient` to intercept facilitator tokens, load client-side profile editing fields, support photo uploads to Firebase Storage, and render a premium side-by-side layout (Option 1).

**Tech Stack:** React, Next.js App Router, Tailwind CSS, Lucide icons, Firebase Firestore & Storage.

---

## 1. What Could Go Wrong & Resolutions

### A. Registrant DB Subcollection Crashes
* **Risk**: The current registrant attendance logging action `logMeetingAttendance` assumes all attendees exist in the `meetings/[meetingId]/registrants` subcollection. Since facilitators are stored in an array on the meeting document, invoking this action with a facilitator ID will cause document updates to crash.
* **Resolution**: Build a dedicated server action `logFacilitatorAttendance` that handles logging presence directly in the primary `attendees` collection with the role field set to `'facilitator'`, avoiding subcollection lookups.

### B. Upload Permissions in Firebase Storage
* **Risk**: A facilitator's browser may reject file uploads or throw bucket permission errors depending on security rules.
* **Resolution**: Upload facilitator avatars under path `facilitator-pictures/${meetingId}-${facilitatorId}`. Show an inline error banner next to the avatar if the file upload is blocked, prompting them to select a smaller image or retry.

### C. Resource Cleanup on Unmount
* **Risk**: The file picker state or upload listener may continue execution if they navigate away during upload.
* **Resolution**: Guard state updates with component mount checks, and disable the save/join buttons while a photo is uploading.

---

## 2. Refactored & Scalable Design

1. **Independent Server Actions**: Keep registrant attendance and facilitator attendance isolated to separate modules or logical action blocks to maintain scalability.
2. **Visual Feedback Loop**: Display progress loaders directly overlaying the profile picture when uploads are in progress.
3. **No Waterfalls**: Load meeting data and facilitator profiles in a single query by reading the parent meeting document.

---

### Task 1: Facilitator Profile Update & Attendance Server Actions

**Files:**
- Modify: `src/app/actions/meeting-facilitator-actions.ts`

- [ ] **Step 1: Add the updateMeetingFacilitatorAction and logFacilitatorAttendance server actions**
  Add the following server action code at the end of [meeting-facilitator-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/actions/meeting-facilitator-actions.ts):

  ```typescript
  export async function updateMeetingFacilitatorAction(
    meetingId: string,
    facilitatorId: string,
    updates: { name: string; bio: string; image?: string }
  ) {
    try {
      const meetingRef = adminDb.collection('meetings').doc(meetingId);
      const meetingSnap = await meetingRef.get();
      if (!meetingSnap.exists) {
        throw new Error('Meeting not found.');
      }
      const meetingData = meetingSnap.data() as Meeting;
      const facilitators = meetingData.facilitators || [];

      const index = facilitators.findIndex((f) => f.id === facilitatorId);
      if (index === -1) {
        throw new Error('Facilitator not found in this meeting.');
      }

      // Update fields inside the array
      facilitators[index] = {
        ...facilitators[index],
        name: updates.name,
        bio: updates.bio,
        image: updates.image !== undefined ? updates.image : facilitators[index].image,
      };

      await meetingRef.update({ facilitators });
      return { success: true };
    } catch (error: any) {
      console.error('[updateMeetingFacilitatorAction] Failed:', error);
      return { success: false, error: error.message };
    }
  }

  export async function logFacilitatorAttendance(
    meetingId: string,
    facilitatorId: string,
    metadata: {
      name: string;
      token: string;
      entityId?: string;
    }
  ) {
    try {
      const now = new Date().toISOString();
      
      const existingAttendeeSnap = await adminDb
        .collection('attendees')
        .where('meetingId', '==', meetingId)
        .where('registrantId', '==', facilitatorId)
        .limit(1)
        .get();

      if (existingAttendeeSnap.empty) {
        await adminDb.collection('attendees').add({
          meetingId,
          entityId: metadata.entityId || '',
          parentName: metadata.name,
          childrenNames: [],
          joinedAt: now,
          registrantId: facilitatorId,
          registrantToken: metadata.token,
          role: 'facilitator',
        });
      } else {
        const docId = existingAttendeeSnap.docs[0].id;
        await adminDb.collection('attendees').doc(docId).update({
          lastRejoinedAt: now,
        });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('[logFacilitatorAttendance] Failed:', error);
      return { success: false, error: error.message };
    }
  }
  ```

---

### Task 2: Facilitator Verification & UI Layout Implementation

**Files:**
- Modify: `src/components/joining-page-client.tsx`

- [ ] **Step 1: Add imports and state variables**
  Add imports for `Input`, `Textarea`, `Camera`, `Upload`, and Firebase Storage at the top of [joining-page-client.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/joining-page-client.tsx):

  ```typescript
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Camera, Upload } from 'lucide-react';
  import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import { updateMeetingFacilitatorAction, logFacilitatorAttendance } from '@/app/actions/meeting-facilitator-actions';
  ```

  And add the following state variables inside the `JoiningPageClient` component:

  ```typescript
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [facilitator, setFacilitator] = useState<MeetingFacilitator | null>(null);
  const [facName, setFacName] = useState('');
  const [facBio, setFacBio] = useState('');
  const [facImage, setFacImage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [uploadError, setUploadError] = useState('');
  ```

- [ ] **Step 2: Intercept facilitator token in the initial validation effect**
  Update the main `resolve` function inside the initial `useEffect` logic of [joining-page-client.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/joining-page-client.tsx) around lines 145-168 to match:

  ```typescript
        // Resolve facilitators first
        const matchedFac = meetingDoc.facilitators?.find(f => f.joinLink === token);
        if (matchedFac) {
          setIsFacilitator(true);
          setFacilitator(matchedFac);
          setFacName(matchedFac.name || '');
          setFacBio(matchedFac.bio || '');
          setFacImage(matchedFac.image || '');
          setPageState('waiting');
          return;
        }

        // Validate token against registrants (if no facilitator match)
        const registrantsRef = collection(firestore, `meetings/${meetingDoc.id}/registrants`);
        const tokenQuery = query(registrantsRef, where('token', '==', token), limit(1));
        const tokenSnap = await getDocs(tokenQuery);
  ```

- [ ] **Step 3: Modify dynamic text and loaders to skip for facilitators**
  Add conditions to bypass registrant auto-redirect countdowns if `isFacilitator` is true:
  1. In the `useEffect` handling `autoRedirectCountdown` (lines 213-230), add a guard `if (isFacilitator) return;` at the start.
  2. In the `useEffect` monitoring early entry time / start time (lines 189-210), force `setIsJoinReady(true)` if `isFacilitator` is true.

- [ ] **Step 4: Add photo upload and update profile handlers**
  Add the following handler methods inside the `JoiningPageClient` component:

  ```typescript
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !meeting || !facilitator) return;
    const file = event.target.files[0];
    setIsUploadingPhoto(true);
    setUploadError('');
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `facilitator-pictures/${meeting.id}-${facilitator.id}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFacImage(downloadURL);
    } catch (err: any) {
      console.error('[FacilitatorPhotoUpload] Failed:', err);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!meeting || !facilitator) return;
    setIsSavingProfile(true);
    setShowSavedNotification(false);
    try {
      const res = await updateMeetingFacilitatorAction(meeting.id, facilitator.id, {
        name: facName,
        bio: facBio,
        image: facImage,
      });
      if (res.success) {
        setFacilitator(prev => prev ? { ...prev, name: facName, bio: facBio, image: facImage } : null);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 3000);
      }
    } catch (err) {
      console.error('[handleSaveProfile] Failed:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };
  ```

- [ ] **Step 5: Modify attendance logging and join handler**
  Update the `handleJoinMeeting` function to log facilitator presence via the new server action:

  ```typescript
  const handleJoinMeeting = useCallback(async () => {
    if (!meeting || isRedirectTriggered) return;
    setIsRedirectTriggered(true);

    if (isFacilitator && facilitator) {
      try {
        await logFacilitatorAttendance(meeting.id, facilitator.id, {
          name: facName,
          token: token || '',
          entityId: meeting.entityId,
        });
      } catch (err) {
        console.error('[JoiningPageClient] Facilitator attendance logging failed:', err);
      }
    } else if (registrant) {
      const regData = registrant.registrationData || {};
      const childrenRaw = regData.children || regData.childrenNames || regData['Children Names'] || regData['Child Names'] || [];
      const childrenArray = Array.isArray(childrenRaw) ? childrenRaw : typeof childrenRaw === 'string' ? childrenRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      try {
        await logMeetingAttendance(meeting.id, registrant.id, {
          registrantName: registrant.name,
          registrantToken: registrant.token,
          entityId: meeting.entityId,
          childrenNames: childrenArray,
        });
      } catch (err) {
        console.error('[JoiningPageClient] Attendance logging failed:', err);
      }
    }

    if (meeting.meetingLink) {
      window.location.href = meeting.meetingLink;
    } else {
      setPageState('redirected');
    }
  }, [meeting, registrant, isFacilitator, facilitator, facName, token, isRedirectTriggered]);
  ```

- [ ] **Step 6: Render Option 1 Layout for Facilitators**
  Replace the waiting state render block in [joining-page-client.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/joining-page-client.tsx) with a split grid structure when `isFacilitator` is true:

  ```typescript
          {/* Waiting State — Main View */}
          {pageState === 'waiting' && (isFacilitator || registrant) && (
            <>
              {isFacilitator ? (
                /* Option 1: Side-by-Side Facilitator Layout */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left max-w-5xl mx-auto">
                  
                  {/* Left Column: Profile Card */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="space-y-2">
                      <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                        Presenter Workspace
                      </Badge>
                      <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-white">
                        Welcome, {facName}!
                      </h1>
                      <p className="text-xs text-slate-400 font-medium">
                        Verify or adjust your presenter details before launching the webinar room.
                      </p>
                    </div>

                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                        
                        {/* Interactive Avatar Upload */}
                        <div className="relative group cursor-pointer shrink-0">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all bg-slate-800 flex items-center justify-center">
                            {facImage ? (
                              <img src={facImage} alt={facName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl font-bold uppercase text-primary/40">
                                {facName ? facName.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
                              </span>
                            )}
                            {isUploadingPhoto && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                              </div>
                            )}
                          </div>
                          {!isUploadingPhoto && (
                            <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            id="fac-photo-input"
                          />
                          <label htmlFor="fac-photo-input" className="absolute inset-0 cursor-pointer" />
                        </div>

                        {/* Fields */}
                        <div className="flex-grow w-full space-y-4 text-left">
                          <div className="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presenter Name</label>
                            <Input
                              type="text"
                              value={facName}
                              onChange={(e) => setFacName(e.target.value)}
                              className="w-full h-11 bg-slate-950/50 border border-slate-800 rounded-xl px-4 text-sm font-semibold text-white focus:outline-none focus:border-primary/50"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presenter Bio</label>
                            <Textarea
                              value={facBio}
                              onChange={(e) => setFacBio(e.target.value)}
                              className="w-full h-20 bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-sm font-medium text-slate-300 focus:outline-none focus:border-primary/50 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      {uploadError && (
                        <p className="text-red-400 text-xs font-semibold">{uploadError}</p>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        {showSavedNotification ? (
                          <span className="text-emerald-400 text-xs font-semibold animate-pulse flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" /> Profile saved!
                          </span>
                        ) : (
                          <div />
                        )}
                        <Button
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile || isUploadingPhoto}
                          size="sm"
                          className="h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700/50 gap-2"
                        >
                          {isSavingProfile ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Save Profile Changes
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Meeting Info Card */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl space-y-6">
                      
                      <div className="space-y-2 text-center">
                        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                          Meeting Active
                        </Badge>
                        <h4 className="text-xl font-bold text-white mt-2 leading-tight">
                          {meeting.heroTitle || resolvedName || 'SmartSapp Kickoff Session'}
                        </h4>
                        <div className="flex flex-col gap-1 items-center justify-center text-xs font-semibold text-primary pt-2">
                          <span>{format(new Date(meeting.meetingTime), 'EEEE, MMMM d, yyyy')}</span>
                          <span>{format(new Date(meeting.meetingTime), 'h:mm a')}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Button
                          onClick={handleJoinMeeting}
                          disabled={isRedirectTriggered || isUploadingPhoto}
                          size="lg"
                          className="w-full h-14 bg-primary hover:bg-primary/95 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2"
                        >
                          {isRedirectTriggered ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Rocket className="h-5 w-5" />
                          )}
                          Join Meeting Now
                        </Button>
                        <p class="text-[10px] text-center text-slate-400 font-semibold uppercase tracking-wider">
                          Always open for facilitators
                        </p>
                      </div>

                    </div>
                  </div>

                </div>
              ) : (
                /* Registrant Layout (Existing logic) */
                ...
              )}
            </>
          )}
  ```

---

## 5. Verification Plan

### Manual Verification
1. Open the browser testing helper or client page using a facilitator's token link.
2. Confirm the Option 1 two-column layout renders correctly.
3. Update the presenter name and bio, select a photo to upload.
4. Verify the database updates.
5. Click **Join Meeting Now** and confirm you are immediately directed to the meeting room link.
