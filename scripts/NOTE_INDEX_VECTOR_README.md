# Quick Notes — Semantic Search Setup (`note_index` vector index)

Semantic "ask your notes" search embeds the query with Google `text-embedding-004`
(**768 dimensions**) and runs a Firestore `findNearest` (COSINE) over the
`note_index` collection. Two one-time ops steps are required per environment.

## 1. Create the vector index (gcloud)

The dimension **must** be 768 to match `EMBED_DIMENSIONS` in
`src/ai/flows/embed-note-flow.ts`. Because search pre-filters by `workspaceId`,
the index includes that field:

```bash
gcloud firestore indexes composite create \
  --collection-group=note_index \
  --query-scope=COLLECTION \
  --field-config=field-path=workspaceId,order=ASCENDING \
  --field-config=field-path=embedding,vector-config='{"dimension":768,"flat":{}}'
```

(Use `--database=<id>` if not the default database.)

## 2. Backfill the index with embeddings

Requires a Google AI key (`GEMINI_API_KEY`) available to the default Genkit
instance:

```bash
npm run backfill:note-index -- --workspace=<workspaceId> --embed
```

Run per workspace. Re-run to refresh after large changes (ongoing freshness via
Firestore triggers / a scheduled re-sync is a separate ops follow-up; the
keyword board search and read-time aggregator work without this).

## Notes
- Without these steps, the **"Ask your notes"** dialog returns a friendly
  "not set up yet" message (code `no_index`) — it never errors hard.
- If you change the embedding model/dimension, you must recreate the index and
  re-run the backfill.
