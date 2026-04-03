---
name: hangke-classroom
description: Guided SOP for setting up and using Hangke Interactive Classroom locally. Use when the user wants to initialize the repo, choose a startup mode, configure unified provider keys, start the service, or generate/publish/export a classroom. Proceed one phase at a time and ask for confirmation before each state-changing action.
user-invocable: true
metadata: { "hangke": { "emoji": "🏫" } }
---

# Hangke Interactive Classroom Skill

Use this skill as a confirmation-heavy local deployment and classroom delivery SOP.

## Core Rules

- Move one phase at a time.
- Before any state-changing action, ask for confirmation.
- If local state already exists, show what you found and ask whether to reuse it.
- Do not assume the agent's own model or API key will be reused by the service.
- Unified provider configuration must come from local server-side config or the admin vault.
- Do not ask the user to paste API keys into chat.
- Prefer guiding the user to edit `.env.local` or server-side provider config themselves.
- Once setup is complete and the user clearly asks to generate a classroom, do not ask for a second confirmation before submitting the generation job.
- Keep confirmations for local file reads such as reading a PDF from disk.

## Optional Skill Config

If present, read defaults from `~/.openclaw/openclaw.json` under:

```jsonc
{
  "skills": {
    "entries": {
      "hangke-classroom": {
        "enabled": true,
        "config": {
          "repoDir": "/path/to/NEW-AI-EDU",
          "url": "http://localhost:3000"
        }
      }
    }
  }
}
```

- Use `repoDir` and `url` only as defaults.
- Still confirm before acting.

## SOP Phases

### 1. Clone Or Reuse Existing Repo

Load [references/clone.md](references/clone.md).

Use this when the user has not installed the repo yet or when you need to confirm which local checkout should be used.

### 2. Choose Startup Mode

Load [references/startup-modes.md](references/startup-modes.md).

Use this after the repo location is confirmed. Present the available startup modes, recommend one, and wait for the user's choice.

### 3. Configure Provider Keys

Load [references/provider-keys.md](references/provider-keys.md).

Use this before generation or digital-human setup. Recommend a provider path and tell the user exactly which config file to edit. If generation later fails due to provider, model, or auth issues, return to this phase and direct the user back to the same server-side config.

### 4. Start And Verify Service

Start the selected mode, then verify the service with `GET {url}/api/health`.

### 5. Generate, Publish, And Export A Classroom

Load [references/generate-flow.md](references/generate-flow.md).

Use this only after the service is healthy. Confirm before reading local PDFs. If the user has already clearly asked to generate, do not ask for a second confirmation just before calling the generation API. After the classroom is available, continue through publish and export guidance when requested.

## Response Style

- Keep each step short and explicit.
- Prefer 2-3 concrete options when the user must choose.
- Always include the recommended option first and explain why in one sentence.
- After a step completes, say what changed and what the next confirmation is for.
- When returning a classroom link, place the raw absolute URL on its own line with no markdown link syntax or tables.
