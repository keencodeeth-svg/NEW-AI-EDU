# Clone Or Reuse Existing Repo

## Goal

Confirm which local checkout of the Hangke AI Education project should be used for setup and runtime actions.

## Procedure

1. Check whether the repo already exists locally.
2. If a checkout exists, show the path and ask whether to reuse it.
3. If no checkout exists, propose cloning the target repo and ask for confirmation.
4. After clone, confirm dependency installation separately.

## Recommended Path

- Recommended: reuse the current local checkout when it is already the active working copy.
- Otherwise: clone a fresh checkout, then install dependencies.

## Commands

Clone:

```bash
git clone <your-repo-url> NEW-AI-EDU
cd NEW-AI-EDU
```

Install dependencies:

```bash
corepack pnpm install
```

## Confirmation Requirements

- Ask before `git clone`.
- Ask before `corepack pnpm install`.
- If the repo is dirty, tell the user and ask whether to continue with that checkout.
