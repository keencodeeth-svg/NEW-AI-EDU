# Generate Flow

## Preconditions

- Repo path is confirmed
- Startup mode has been chosen
- The local service is healthy at the selected `url`
- Core provider keys are configured

## Requirement-Only Generation

If the user has already clearly asked to generate the classroom and the preconditions are satisfied, submit the generation job immediately. Do not ask for a second confirmation just before calling `/api/generate-classroom`.

Submit:

```text
POST {url}/api/generate-classroom
```

Request body example:

```json
{
  "requirement": "为八年级物理设计一节适合整班投屏观看的互动课堂"
}
```

Only send supported content fields:

- `requirement` (required)
- optional `pdfContent`
- optional `language`
- optional `enableWebSearch`
- optional `enableImageGeneration`
- optional `enableVideoGeneration`
- optional `enableTTS`
- optional `agentMode`

## PDF-Based Generation

1. Resolve the absolute path to the PDF.
2. Confirm before reading the file.
3. Parse the PDF first:

```text
POST {url}/api/parse-pdf
```

4. Then send `requirement` plus `pdfContent` to:

```text
POST {url}/api/generate-classroom
```

## Polling Loop

After the job is submitted:

1. Save `jobId`, `pollUrl`, and `pollIntervalMs`.
2. Do not submit another generation job while this one is still `queued` or `running`.
3. Poll:

```text
GET {pollUrl}
```

4. Prefer a conservative polling cadence of about 60 seconds between polls for generation jobs.
5. Stop only when `status` becomes `succeeded` or `failed`.

## Reliability Rules

- Never restart the job just because a poll request fails once.
- If a poll request returns a transient network error or `5xx`, wait and retry the same `pollUrl`.
- If the job is still running after many polls, tell the user it is still in progress and continue polling instead of resubmitting.
- On `failed`, surface the server error and include the `jobId`.
- On `succeeded`, use `result.classroomId` and `result.url` from the final poll response.

## After Generation

If the user asks for delivery support, continue with:

1. Publish the classroom for whole-class viewing
2. Export `PPTX`
3. Export the resource pack
4. Explain where the manifest and interaction pages are stored in the exported package

## What To Return

Return the generated classroom ID plus a directly clickable classroom URL.

Use a compact format like:

```text
Classroom ID: Uyh82Y32ZK
Classroom URL:
http://localhost:3000/classroom/Uyh82Y32ZK
```
