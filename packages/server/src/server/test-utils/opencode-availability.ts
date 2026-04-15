import { execFileSync } from "node:child_process";

import type { AgentModelDefinition } from "../agent/agent-sdk-types.js";
import { OpenCodeAgentClient } from "../agent/providers/opencode-agent.js";
import { createTestLogger } from "../../test-utils/test-logger.js";

export function isBinaryInstalled(binary: string): boolean {
  try {
    const out = execFileSync("which", [binary], { encoding: "utf8" }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

export async function probeOpenCodeModelCatalog(): Promise<AgentModelDefinition[] | null> {
  if (!isBinaryInstalled("opencode")) {
    return null;
  }

  try {
    const client = new OpenCodeAgentClient(createTestLogger());
    const models = await client.listModels();
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}
