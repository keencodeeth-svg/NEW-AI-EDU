# Startup Modes

## Goal

Help the user choose how Hangke Classroom should run before you start anything.

## Options

### 1. Development Mode

Recommended for first-time setup, integration work, and debugging.

```bash
corepack pnpm dev
```

Tradeoff:

- Fastest feedback loop
- Best for verifying provider changes and page flow
- Not fully representative of production startup

### 2. Production-Like Local Mode

Recommended when the user wants behavior closer to a deployed server.

```bash
corepack pnpm build && corepack pnpm start
```

Tradeoff:

- Closer to production behavior
- Slower startup than `dev`

### 3. Docker Compose

Use only when the user explicitly wants a containerized setup.

```bash
docker compose up --build
```

Tradeoff:

- Cleaner isolation
- Heavier and slower
- Less convenient for app-level debugging

## Recommendation Order

1. `corepack pnpm dev`
2. `corepack pnpm build && corepack pnpm start`
3. `docker compose up --build`

## Health Check

After startup, verify:

```bash
curl -fsS http://localhost:3000/api/health
```

If the skill config provides a custom `url`, use that instead.

## Confirmation Requirements

- Ask the user to choose one startup mode.
- Ask again before running the selected command.
