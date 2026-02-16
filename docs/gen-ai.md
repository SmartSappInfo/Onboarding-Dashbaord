# Feature: Generative AI

## Summary

The application integrates with Google's Generative AI models via the Genkit framework to provide intelligent features that assist administrators. These features focus on automating content creation and data analysis, significantly reducing manual effort.

## Current Implementation

-   **Framework:** All AI functionality is built using **Genkit**, a framework for building production-ready AI flows. It is configured in `src/ai/genkit.ts`.
-   **AI-Powered Survey Generation:**
    -   **Flow:** `generateSurveyFlow` in `src/ai/flows/generate-survey-flow.ts`.
    -   **Functionality:** An administrator can provide raw text (e.g., a list of questions, a document outline) or a URL to a public webpage. The AI model analyzes this content and generates a fully structured survey object in JSON format.
    -   **Output:** The AI returns a title, description, an array of questions and layout elements, a thank-you message, and a suggested search query for a banner image. This generated structure is then used to pre-fill the "New Survey" form.
-   **AI-Powered Survey Analysis:**
    -   **Flow:** `generateSurveySummaryFlow` and `querySurveyDataFlow` in their respective files under `src/ai/flows/`.
    -   **Functionality:** On the survey results page, administrators have two AI capabilities:
        1.  **Generate Summary:** Click a button to have the AI analyze all survey responses and produce a high-level summary, including key takeaways and critical findings, formatted in simple HTML.
        2.  **Interactive Q&A:** Use a text prompt to ask specific, natural language questions about the response data (e.g., "What was the most common feedback from users who rated us below 3 stars?"). The AI analyzes the data and provides a direct answer.
-   **Link Metadata Fetching:**
    -   **Flow:** `getLinkMetadataFlow` in `src/ai/flows/get-link-metadata-flow.ts`.
    -   **Functionality:** When an admin adds a new link to the media library, this flow is triggered. It fetches the content of the URL and uses an AI model to parse the HTML, extracting the page title, meta description, and `og:image` URL. This provides a rich preview for link assets.

## Future Enhancements

-   **Image Generation for Banners:** Instead of just suggesting a search query for a survey banner, integrate a text-to-image model (like Imagen) to generate a custom banner image on the fly based on the survey's title and content.
-   **Automated Activity Logging:** Use an AI model to analyze user actions (e.g., edits to a school record) and automatically generate more descriptive and human-readable log entries for the activity feed.
-   **Voice-to-Text Transcription:** In the "Log Activity" modal, add an option for admins to record a voice note. Use a speech-to-text AI model to transcribe the audio into text, saving the admin from typing.
-   **Sentiment Analysis:** Enhance the survey results view by automatically running sentiment analysis on open-ended text responses, tagging each response as positive, negative, or neutral.
