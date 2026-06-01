import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "deploy-prebuilt-remote.sh");
const scriptContent = fs.readFileSync(scriptPath, "utf8");

test("external health check stays inside remote rollback window", () => {
  assert.match(scriptContent, /DEPLOY_EXTERNAL_HEALTH_URL/, "deploy script should be read from repository root");

  const remoteScriptMatch = scriptContent.match(/<<'REMOTE_SCRIPT'\n([\s\S]*?)\nREMOTE_SCRIPT/);

  assert.ok(remoteScriptMatch, "remote here-doc should exist");

  const remoteScript = remoteScriptMatch[1];

  const trapIndex = remoteScript.indexOf("trap 'rollback_production' ERR");
  const trapClearIndex = remoteScript.indexOf("trap - ERR");
  const externalHealthCallIndex = remoteScript.indexOf("\nrun_external_health\n");
  const externalHealthCurlIndex = remoteScript.indexOf('curl -fsS --max-time 20 "$external_health_url" >/dev/null');
  const localTailExternalHealthIndex = scriptContent.indexOf(
    'if [[ -n "$DEPLOY_EXTERNAL_HEALTH_URL" ]]; then'
  );

  assert.notEqual(trapIndex, -1, "remote rollback trap should exist");
  assert.notEqual(trapClearIndex, -1, "remote rollback trap should be cleared after validation");
  assert.notEqual(externalHealthCurlIndex, -1, "remote script should define external health check");
  assert.notEqual(externalHealthCallIndex, -1, "remote script should invoke external health check");
  assert.ok(
    externalHealthCallIndex > trapIndex && externalHealthCallIndex < trapClearIndex,
    "external health check invocation must run while rollback trap is active"
  );
  assert.equal(
    localTailExternalHealthIndex,
    -1,
    "script should not keep a separate post-SSH external health check outside rollback handling"
  );
});

test("remote activation arguments are shell-quoted before ssh execution", () => {
  assert.match(
    scriptContent,
    /REMOTE_SCRIPT_ARGS=\(\s*"\$DEPLOY_TARGET_COMMIT"[\s\S]*"\$DEPLOY_POST_DEPLOY_TIMEOUT_MS"\s*\)/,
    "deploy script should collect remote activation args in an array"
  );
  assert.match(
    scriptContent,
    /printf -v quoted_remote_arg "%q" "\$remote_arg"/,
    "deploy script should shell-quote each remote activation arg"
  );
  assert.match(
    scriptContent,
    /remote_command\+=" \$quoted_remote_arg"/,
    "deploy script should append the quoted arg to the remote command"
  );
  assert.doesNotMatch(
    scriptContent,
    /ssh "\$\{SSH_OPTS\[@\]\}" "\$DEPLOY_REMOTE_HOST" bash -s --/,
    "deploy script should not pass unescaped positional args through the remote shell"
  );
});
