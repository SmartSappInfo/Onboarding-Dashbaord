# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Troubleshooting

### PDF Viewer "Failed to fetch" / CORS Error

If you are trying to use a feature that loads PDFs (like the Doc Signing editor) and you see a "Failed to fetch" or "CORS policy" error in the browser console, it means your application's domain is not authorized to request files from your Firebase Storage bucket.

To fix this, a CORS policy must be applied to your bucket.

**1. Create the Bucket (if it doesn't exist)**

If you run the `gcloud` command and get a `404 Not Found` error for your bucket, it likely hasn't been created yet.

*   Go to the Firebase Console for your project.
*   Navigate to the **Build > Storage** section.
*   Click the **"Get Started"** button and follow the prompts. This will create your default storage bucket.

**2. Apply the CORS Configuration**

Once the bucket exists, run the following command from your project's root directory to apply the necessary policy from the `cors.json` file:

```bash
gcloud storage buckets update gs://[YOUR_PROJECT_ID].appspot.com --cors-file=cors.json
```

Replace `[YOUR_PROJECT_ID]` with your actual Firebase Project ID. After this command succeeds, the PDF viewer should load files correctly.
