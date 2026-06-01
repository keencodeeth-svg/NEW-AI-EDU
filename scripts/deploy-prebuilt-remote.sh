#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_REMOTE_HOST=root@example.com corepack pnpm deploy:remote:prebuilt

Required env:
  DEPLOY_REMOTE_HOST            SSH target, for example root@8.136.122.236

Common optional env:
  DEPLOY_EXTERNAL_HEALTH_URL    External health URL, for example https://8.136.122.236/api/health
  DEPLOY_REMOTE_ENV_SOURCE      Remote env source file, default /var/www/HK-AIEDU/.env.production
  DEPLOY_REMOTE_REPO_DIR        Remote repo dir, default /var/www/HK-AIEDU
  DEPLOY_REMOTE_RELEASES_DIR    Remote releases dir, default /var/www/releases
  DEPLOY_PM2_APP_NAME           PM2 app name, default hk-ai-edu
  DEPLOY_CANARY_APP_NAME        PM2 canary app name, default <app>-canary
  DEPLOY_SKIP_BUILD             Skip local build when set to 1
  DEPLOY_ALLOW_DIRTY            Allow deploying a dirty worktree when set to 1
  DEPLOY_SKIP_CANARY            Skip port 3001 canary when set to 1
  DEPLOY_POST_DEPLOY_COMMAND    Optional command to run as post-deploy smoke
  DEPLOY_POST_DEPLOY_URL        Optional URL to check as post-deploy smoke
  DEPLOY_POST_DEPLOY_EXPECT_STATUS
                                Optional comma-separated accepted statuses, default 200
  DEPLOY_POST_DEPLOY_TIMEOUT_MS Optional timeout for post-deploy URL check, default 10000

What it does:
  1. Optionally runs a local build.
  2. Creates a standalone release archive with vendored runtime deps, scripts, and static assets.
  3. Uploads the archive to the remote host.
  4. Restores the remote .env.production into the release dir.
  5. Runs db:migrate, starts canary, then reloads PM2 with rollback-aware safety checks.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

log() {
  printf '[deploy] %s\n' "$1"
}

detect_package_manager() {
  if [[ -f "pnpm-lock.yaml" ]]; then
    echo "pnpm"
    return
  fi

  if [[ -f "package-lock.json" ]]; then
    echo "npm"
    return
  fi

  if [[ -f "yarn.lock" ]]; then
    echo "yarn"
    return
  fi

  echo "npm"
}

require_cmd git
require_cmd npm
require_cmd tar
require_cmd ssh
require_cmd scp
require_cmd curl

DEPLOY_REMOTE_HOST="${DEPLOY_REMOTE_HOST:-}"
if [[ -z "$DEPLOY_REMOTE_HOST" ]]; then
  usage >&2
  echo "DEPLOY_REMOTE_HOST is required." >&2
  exit 1
fi

DEPLOY_PROJECT_NAME="${DEPLOY_PROJECT_NAME:-HK-AIEDU}"
DEPLOY_REMOTE_REPO_DIR="${DEPLOY_REMOTE_REPO_DIR:-/var/www/HK-AIEDU}"
DEPLOY_REMOTE_RELEASES_DIR="${DEPLOY_REMOTE_RELEASES_DIR:-/var/www/releases}"
DEPLOY_REMOTE_ENV_SOURCE="${DEPLOY_REMOTE_ENV_SOURCE:-$DEPLOY_REMOTE_REPO_DIR/.env.production}"
DEPLOY_PM2_APP_NAME="${DEPLOY_PM2_APP_NAME:-hk-ai-edu}"
DEPLOY_CANARY_APP_NAME="${DEPLOY_CANARY_APP_NAME:-${DEPLOY_PM2_APP_NAME}-canary}"
DEPLOY_TARGET_COMMIT="${DEPLOY_TARGET_COMMIT:-$(git rev-parse HEAD)}"
DEFAULT_REMOTE_INSTALL_COMMAND=":"
DEFAULT_REMOTE_MIGRATE_COMMAND="node scripts/init-db.mjs"
PROJECT_PACKAGE_MANAGER="$(detect_package_manager)"
case "$PROJECT_PACKAGE_MANAGER" in
  pnpm)
    require_cmd corepack
    DEFAULT_BUILD_COMMAND="corepack pnpm build"
    ;;
  yarn)
    require_cmd corepack
    DEFAULT_BUILD_COMMAND="corepack yarn build"
    ;;
  *)
    DEFAULT_BUILD_COMMAND="npm run build"
    ;;
esac

DEPLOY_BUILD_COMMAND="${DEPLOY_BUILD_COMMAND:-$DEFAULT_BUILD_COMMAND}"
DEPLOY_REMOTE_INSTALL_COMMAND="${DEPLOY_REMOTE_INSTALL_COMMAND:-$DEFAULT_REMOTE_INSTALL_COMMAND}"
DEPLOY_REMOTE_MIGRATE_COMMAND="${DEPLOY_REMOTE_MIGRATE_COMMAND:-$DEFAULT_REMOTE_MIGRATE_COMMAND}"
DEPLOY_REMOTE_PRODUCTION_PORT="${DEPLOY_REMOTE_PRODUCTION_PORT:-3000}"
DEPLOY_REMOTE_CANARY_PORT="${DEPLOY_REMOTE_CANARY_PORT:-3001}"
DEPLOY_CANARY_WAIT_SECONDS="${DEPLOY_CANARY_WAIT_SECONDS:-8}"
DEPLOY_PRODUCTION_WAIT_SECONDS="${DEPLOY_PRODUCTION_WAIT_SECONDS:-5}"
DEPLOY_EXTERNAL_HEALTH_URL="${DEPLOY_EXTERNAL_HEALTH_URL:-}"
DEPLOY_SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
DEPLOY_ALLOW_DIRTY="${DEPLOY_ALLOW_DIRTY:-0}"
DEPLOY_SKIP_CANARY="${DEPLOY_SKIP_CANARY:-0}"
DEPLOY_POST_DEPLOY_COMMAND="${DEPLOY_POST_DEPLOY_COMMAND:-}"
DEPLOY_POST_DEPLOY_URL="${DEPLOY_POST_DEPLOY_URL:-}"
DEPLOY_POST_DEPLOY_EXPECT_STATUS="${DEPLOY_POST_DEPLOY_EXPECT_STATUS:-200}"
DEPLOY_POST_DEPLOY_TIMEOUT_MS="${DEPLOY_POST_DEPLOY_TIMEOUT_MS:-10000}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"

SSH_OPTS=(-p "$DEPLOY_SSH_PORT" -o ConnectTimeout=20)
SCP_OPTS=(-P "$DEPLOY_SSH_PORT" -o ConnectTimeout=20)

log "Detected package manager: $PROJECT_PACKAGE_MANAGER"

WORKTREE_STATUS="$(git status --short)"
RELEASE_LABEL="$DEPLOY_TARGET_COMMIT"
if [[ -n "$WORKTREE_STATUS" ]]; then
  if [[ "$DEPLOY_ALLOW_DIRTY" != "1" ]]; then
    echo "Refusing to deploy a dirty worktree. Commit/stash changes or set DEPLOY_ALLOW_DIRTY=1." >&2
    git status --short >&2
    exit 1
  fi
  RELEASE_LABEL="${DEPLOY_TARGET_COMMIT}-dirty-$(date '+%Y%m%d%H%M%S')"
fi

if [[ "$DEPLOY_SKIP_BUILD" != "1" ]]; then
  log "Running local build: $DEPLOY_BUILD_COMMAND"
  eval "$DEPLOY_BUILD_COMMAND"
else
  log "Skipping local build because DEPLOY_SKIP_BUILD=1"
fi

if [[ ! -f ".next/BUILD_ID" ]]; then
  echo "Missing .next/BUILD_ID. Run a local build first or unset DEPLOY_SKIP_BUILD." >&2
  exit 1
fi

if [[ ! -f ".next/standalone/server.js" ]]; then
  echo "Missing .next/standalone/server.js. Ensure Next.js standalone output is enabled and the build completed successfully." >&2
  exit 1
fi

if [[ ! -d ".next/static" ]]; then
  echo "Missing .next/static. Run a local build first or unset DEPLOY_SKIP_BUILD." >&2
  exit 1
fi

log "Verifying standalone prompt assets"
node scripts/verify-standalone-prompts.mjs

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hk-ai-edu-deploy.XXXXXX")"
STAGE_DIR="$TEMP_DIR/release"
ARCHIVE_NAME="${DEPLOY_PROJECT_NAME}-${RELEASE_LABEL}-prebuilt.tgz"
ARCHIVE_PATH="$TEMP_DIR/$ARCHIVE_NAME"
REMOTE_ARCHIVE_PATH="$DEPLOY_REMOTE_RELEASES_DIR/$ARCHIVE_NAME"
REMOTE_RELEASE_DIR="$DEPLOY_REMOTE_RELEASES_DIR/${DEPLOY_PROJECT_NAME}-${RELEASE_LABEL}"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

log "Preparing standalone release directory at $STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R ".next/standalone/." "$STAGE_DIR/"
mkdir -p "$STAGE_DIR/.next"
cp -R ".next/static" "$STAGE_DIR/.next/static"
rm -rf \
  "$STAGE_DIR/scripts" \
  "$STAGE_DIR/db" \
  "$STAGE_DIR/public" \
  "$STAGE_DIR/data" \
  "$STAGE_DIR/configs" \
  "$STAGE_DIR/assets"
cp -R "scripts" "$STAGE_DIR/scripts"
cp -R "db" "$STAGE_DIR/db"
cp -R "public" "$STAGE_DIR/public"
cp -R "data" "$STAGE_DIR/data"
cp -R "configs" "$STAGE_DIR/configs"
cp -R "assets" "$STAGE_DIR/assets"
cp "package.json" "$STAGE_DIR/package.json"
rm -rf \
  "$STAGE_DIR/.runtime-data" \
  "$STAGE_DIR/tests" \
  "$STAGE_DIR/output" \
  "$STAGE_DIR/docs"

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$STAGE_DIR" >/dev/null 2>&1 || true
fi

log "Creating prebuilt archive at $ARCHIVE_PATH"
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1
tar \
  --exclude='.DS_Store' \
  -czf "$ARCHIVE_PATH" \
  -C "$STAGE_DIR" \
  .

log "Uploading archive to $DEPLOY_REMOTE_HOST:$REMOTE_ARCHIVE_PATH"
ssh "${SSH_OPTS[@]}" "$DEPLOY_REMOTE_HOST" "mkdir -p '$DEPLOY_REMOTE_RELEASES_DIR'"
scp "${SCP_OPTS[@]}" "$ARCHIVE_PATH" "$DEPLOY_REMOTE_HOST:$REMOTE_ARCHIVE_PATH"

log "Activating remote release $REMOTE_RELEASE_DIR"
ssh "${SSH_OPTS[@]}" "$DEPLOY_REMOTE_HOST" bash -s -- \
  "$DEPLOY_TARGET_COMMIT" \
  "$DEPLOY_PROJECT_NAME" \
  "$DEPLOY_REMOTE_ENV_SOURCE" \
  "$DEPLOY_REMOTE_RELEASES_DIR" \
  "$REMOTE_RELEASE_DIR" \
  "$REMOTE_ARCHIVE_PATH" \
  "$DEPLOY_PM2_APP_NAME" \
  "$DEPLOY_CANARY_APP_NAME" \
  "$DEPLOY_REMOTE_PRODUCTION_PORT" \
  "$DEPLOY_REMOTE_CANARY_PORT" \
  "$DEPLOY_CANARY_WAIT_SECONDS" \
  "$DEPLOY_PRODUCTION_WAIT_SECONDS" \
  "$DEPLOY_SKIP_CANARY" \
  "$DEPLOY_REMOTE_INSTALL_COMMAND" \
  "$DEPLOY_REMOTE_MIGRATE_COMMAND" \
  "$DEPLOY_EXTERNAL_HEALTH_URL" \
  "$DEPLOY_POST_DEPLOY_COMMAND" \
  "$DEPLOY_POST_DEPLOY_URL" \
  "$DEPLOY_POST_DEPLOY_EXPECT_STATUS" \
  "$DEPLOY_POST_DEPLOY_TIMEOUT_MS" <<'REMOTE_SCRIPT'
set -euo pipefail

target_commit="$1"
project_name="$2"
remote_env_source="$3"
remote_releases_dir="$4"
remote_release_dir="$5"
remote_archive_path="$6"
pm2_app_name="$7"
canary_app_name="$8"
production_port="$9"
canary_port="${10}"
canary_wait="${11}"
production_wait="${12}"
skip_canary="${13}"
install_command="${14}"
migrate_command="${15}"
external_health_url="${16}"
post_deploy_command="${17}"
post_deploy_url="${18}"
post_deploy_expect_status="${19}"
post_deploy_timeout_ms="${20}"

run_inline_health() {
  local target_port="$1"
  curl -fsS "http://127.0.0.1:${target_port}/api/health" >/dev/null
  if [[ -n "${READINESS_PROBE_TOKEN:-}" ]]; then
    curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" \
      "http://127.0.0.1:${target_port}/api/health/readiness" >/dev/null
  fi
}

run_post_deploy_smoke() {
  if [[ -z "$post_deploy_command" && -z "$post_deploy_url" ]]; then
    return 0
  fi

  POST_DEPLOY_SMOKE_COMMAND="$post_deploy_command" \
  POST_DEPLOY_SMOKE_URL="$post_deploy_url" \
  POST_DEPLOY_SMOKE_EXPECT_STATUS="$post_deploy_expect_status" \
  POST_DEPLOY_SMOKE_TIMEOUT_MS="$post_deploy_timeout_ms" \
    node scripts/post-deploy-smoke.mjs
}

run_external_health() {
  if [[ -z "$external_health_url" ]]; then
    return 0
  fi

  echo "Checking external health: $external_health_url" >&2
  curl -fsS --max-time 20 "$external_health_url" >/dev/null
}

ensure_pm2_process() {
  local app_name="$1"
  local app_port="$2"
  local cwd_path="$3"

  if pm2 describe "$app_name" >/dev/null 2>&1; then
    PORT="$app_port" HOSTNAME="127.0.0.1" pm2 startOrReload "$cwd_path/ecosystem.config.cjs" \
      --only "$app_name" --update-env >/dev/null
    return
  fi

  PORT="$app_port" HOSTNAME="127.0.0.1" pm2 start "$cwd_path/ecosystem.config.cjs" \
    --only "$app_name" --update-env >/dev/null
}

get_pm2_cwd() {
  local app_name="$1"
  pm2 jlist | node -e '
    const fs = require("fs");
    const appName = process.argv[1];
    const input = fs.readFileSync(0, "utf8");
    const processes = JSON.parse(input);
    const match = processes.find((entry) => entry?.name === appName);
    if (!match) process.exit(1);
    const cwd = match.pm2_env?.pm_cwd || match.pm2_env?.cwd || "";
    if (!cwd) process.exit(2);
    process.stdout.write(cwd);
  ' "$app_name"
}

write_ecosystem_config() {
  local cwd_path="$1"
  cat > "$cwd_path/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "${pm2_app_name}",
      script: "npm",
      args: "start",
      cwd: "${cwd_path}",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: "${production_port}",
        HOSTNAME: "127.0.0.1",
      },
    },
    {
      name: "${canary_app_name}",
      script: "npm",
      args: "start",
      cwd: "${cwd_path}",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: "${canary_port}",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
EOF
}

previous_pm2_cwd=""
production_reloaded=0

rollback_production() {
  if [[ "$production_reloaded" != "1" ]]; then
    return 0
  fi

  if [[ -n "$previous_pm2_cwd" && -f "$previous_pm2_cwd/ecosystem.config.cjs" ]]; then
    echo "Production validation failed, rolling back PM2 app ${pm2_app_name} to ${previous_pm2_cwd}" >&2
    PORT="$production_port" HOSTNAME="127.0.0.1" pm2 startOrReload \
      "$previous_pm2_cwd/ecosystem.config.cjs" --only "$pm2_app_name" --update-env >/dev/null || true
    sleep "$production_wait"
    run_inline_health "$production_port" || true
    return 0
  fi

  echo "Production validation failed and no previous PM2 release was found; stopping new app ${pm2_app_name}" >&2
  pm2 delete "$pm2_app_name" >/dev/null 2>&1 || true
}

load_release_env() {
  set -a
  # shellcheck disable=SC1091
  . "$remote_release_dir/.env.production"
  set +a
}

if [[ ! -f "$remote_env_source" ]]; then
  echo "Remote env source not found: $remote_env_source" >&2
  exit 1
fi

mkdir -p "$remote_releases_dir"
rm -rf "$remote_release_dir"
mkdir -p "$remote_release_dir"
tar -xzf "$remote_archive_path" -C "$remote_release_dir"
rm -f "$remote_archive_path"
cp "$remote_env_source" "$remote_release_dir/.env.production"
cd "$remote_release_dir"

printf 'commit=%s\n' "$target_commit" > DEPLOYMENT_INFO
printf 'project=%s\n' "$project_name" >> DEPLOYMENT_INFO
printf 'released_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> DEPLOYMENT_INFO

export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

eval "$install_command" </dev/null
load_release_env

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set after loading .env.production" >&2
  exit 1
fi

eval "$migrate_command" </dev/null

write_ecosystem_config "$remote_release_dir"

if [[ "$skip_canary" != "1" ]]; then
  pm2 delete "$canary_app_name" >/dev/null 2>&1 || true
  load_release_env
  ensure_pm2_process "$canary_app_name" "$canary_port" "$remote_release_dir"
  sleep "$canary_wait"
  run_inline_health "$canary_port"
fi

if pm2 describe "$pm2_app_name" >/dev/null 2>&1; then
  previous_pm2_cwd="$(get_pm2_cwd "$pm2_app_name" || true)"
fi

load_release_env
trap 'rollback_production' ERR
ensure_pm2_process "$pm2_app_name" "$production_port" "$remote_release_dir"
production_reloaded=1
sleep "$production_wait"
run_inline_health "$production_port"
run_external_health
run_post_deploy_smoke
trap - ERR

pm2 delete "$canary_app_name" >/dev/null 2>&1 || true
pm2 save >/dev/null
pm2 list
REMOTE_SCRIPT

log "Remote deploy complete for $RELEASE_LABEL"
log "Active release: $REMOTE_RELEASE_DIR"
