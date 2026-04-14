#!/usr/bin/env npx tsx

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

console.log("📋 Phase 33: Startup Import Tests\n");

console.log("  Testing @getpaseo/server/client subpath export...");
const serverClientModule = await import("@getpaseo/server/client");
assert.equal(
  typeof serverClientModule.DaemonClient,
  "function",
  "Expected @getpaseo/server/client to export DaemonClient",
);
console.log("  ✅ @getpaseo/server/client exports DaemonClient");

console.log("  Testing @getpaseo/server/cli subpath export...");
const serverCliModule = await import("@getpaseo/server/cli");
assert.equal(
  typeof serverCliModule.AGENT_PROVIDER_DEFINITIONS?.[0]?.id,
  "string",
  "Expected @getpaseo/server/cli to export AGENT_PROVIDER_DEFINITIONS",
);
console.log("  ✅ @getpaseo/server/cli exports CLI runtime helpers");

console.log("  Testing CLI daemon host resolution from persisted config...");
const tempHome = await mkdtemp(path.join(tmpdir(), "paseo-cli-startup-"));
await mkdir(tempHome, { recursive: true });
await writeFile(
  path.join(tempHome, "config.json"),
  JSON.stringify(
    {
      daemon: {
        listen: "127.0.0.1:7788",
      },
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

const clientUtilsModule = await import(
  pathToFileURL(path.join(process.cwd(), "packages/cli/src/utils/client.ts")).href
);
const hosts = clientUtilsModule.resolveDefaultDaemonHosts({
  ...process.env,
  PASEO_HOME: tempHome,
});
assert.equal(hosts[0], "127.0.0.1:7788");
console.log("  ✅ CLI host resolution preserves persisted daemon listen");

console.log("\n✅ Phase 33: Startup Import Tests PASSED");
