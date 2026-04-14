// Shell environment resolution adapted from VS Code
// https://github.com/microsoft/vscode/blob/main/src/vs/platform/shell/node/shellEnv.ts
// Licensed under the MIT License.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeSync } from "node:fs";
import { userInfo } from "node:os";
import { basename } from "node:path";
import { resolveDesktopNodeExecPath } from "./daemon/node-entrypoint-launcher.js";

const RESOLVE_TIMEOUT_MS = 10_000;
const SHELL_ENV_PROBE_ARG = "-p";
const SHELL_ENV_PROBE_PATTERN = /^"([^"]+)" \+ JSON\.stringify\(process\.env\) \+ "\1"$/;

function getSystemShell(): string {
  const shell = process.env.SHELL;
  if (shell) return shell;

  try {
    const info = userInfo();
    if (info.shell && info.shell !== "/bin/false") return info.shell;
  } catch {}

  return process.platform === "darwin" ? "/bin/zsh" : "/bin/bash";
}

export function getShellEnvProbeMarker(argv: string[]): string | null {
  if (argv[1] !== SHELL_ENV_PROBE_ARG) {
    return null;
  }

  const expression = argv[2];
  if (typeof expression !== "string") {
    return null;
  }

  const match = SHELL_ENV_PROBE_PATTERN.exec(expression.trim());
  return match?.[1] ?? null;
}

export function maybeHandleShellEnvProbeLaunch(): boolean {
  const marker = getShellEnvProbeMarker(process.argv);
  if (!marker) {
    return false;
  }

  writeSync(process.stdout.fd, `${marker}${JSON.stringify(process.env)}${marker}`);
  return true;
}

function resolveShellEnv(): Record<string, string> | undefined {
  if (process.platform === "win32") return undefined;

  const savedRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
  const savedNoAttach = process.env.ELECTRON_NO_ATTACH_CONSOLE;

  const mark = randomUUID().replace(/-/g, "").slice(0, 12);
  const regex = new RegExp(mark + "({.*})" + mark);

  const shell = getSystemShell();
  const name = basename(shell);
  const probeExecPath = resolveDesktopNodeExecPath({
    execPath: process.execPath,
    isPackaged: process.platform === "darwin" && process.execPath.includes(".app/Contents/MacOS/"),
    platform: process.platform,
  });

  let command: string;
  let shellArgs: string[];

  if (/^(?:pwsh|powershell)(?:-preview)?$/.test(name)) {
    command = `& '${probeExecPath}' -p '''${mark}'' + JSON.stringify(process.env) + ''${mark}'''`;
    shellArgs = ["-Login", "-Command"];
  } else if (name === "nu") {
    command = `^'${probeExecPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
    shellArgs = ["-i", "-l", "-c"];
  } else if (name === "xonsh") {
    command = `import os, json; print("${mark}", json.dumps(dict(os.environ)), "${mark}")`;
    shellArgs = ["-i", "-l", "-c"];
  } else {
    command = `'${probeExecPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
    if (name === "tcsh" || name === "csh") {
      shellArgs = ["-ic"];
    } else {
      shellArgs = ["-i", "-l", "-c"];
    }
  }

  const result = spawnSync(shell, [...shellArgs, command], {
    encoding: "utf8",
    timeout: RESOLVE_TIMEOUT_MS,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ELECTRON_NO_ATTACH_CONSOLE: "1",
    },
  });

  if (result.status !== 0 && result.status !== null) return undefined;
  if (!result.stdout) return undefined;

  const match = regex.exec(result.stdout);
  if (!match?.[1]) return undefined;

  try {
    const env = JSON.parse(match[1]) as Record<string, string>;

    if (savedRunAsNode) {
      env.ELECTRON_RUN_AS_NODE = savedRunAsNode;
    } else {
      delete env.ELECTRON_RUN_AS_NODE;
    }

    if (savedNoAttach) {
      env.ELECTRON_NO_ATTACH_CONSOLE = savedNoAttach;
    } else {
      delete env.ELECTRON_NO_ATTACH_CONSOLE;
    }

    delete env.XDG_RUNTIME_DIR;

    return env;
  } catch {
    return undefined;
  }
}

/**
 * On macOS/Linux, Electron inherits a minimal environment when launched from
 * Finder/Dock. Spawn the user's login shell and capture its full environment
 * via Node's JSON.stringify(process.env), so the daemon and all child processes
 * see the same tools and variables as a normal terminal session.
 *
 * Approach borrowed from VS Code (src/vs/platform/shell/node/shellEnv.ts).
 */
export function inheritLoginShellEnv(): void {
  try {
    const env = resolveShellEnv();
    if (env) {
      Object.assign(process.env, env);
    }
  } catch {
    // Keep inherited environment if shell lookup fails.
  }
}
