import { beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { AgentModelDefinition } from "../agent-sdk-types.js";
import { createDaemonTestContext } from "../test-utils/index.js";
import {
  isBinaryInstalled,
  probeOpenCodeModelCatalog,
} from "../test-utils/opencode-availability.js";

const hasCodex = isBinaryInstalled("codex");

function modelMatchesFamily(model: AgentModelDefinition, family: "sonnet" | "haiku"): boolean {
  const haystacks = [model.id, model.label, model.description ?? ""].map((value) =>
    value.toLowerCase(),
  );
  return haystacks.some((text) => text.includes(family));
}

describe("provider model catalogs (e2e)", () => {
  let hasUsableOpenCodeCatalog = false;

  beforeAll(async () => {
    hasUsableOpenCodeCatalog = (await probeOpenCodeModelCatalog()) !== null;
  }, 60_000);

  test("Claude catalog exposes Sonnet and Haiku variants", async () => {
    const ctx = await createDaemonTestContext();
    try {
      const result = await ctx.client.listProviderModels("claude");

      expect(result.error).toBeNull();
      expect(result.models.length).toBeGreaterThan(0);

      expect(result.models.some((model) => modelMatchesFamily(model, "sonnet"))).toBe(true);
      expect(result.models.some((model) => modelMatchesFamily(model, "haiku"))).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  }, 180_000);

  test.runIf(hasCodex)(
    "Codex catalog exposes gpt-5.1-codex",
    async () => {
      const ctx = await createDaemonTestContext();
      try {
        const result = await ctx.client.listProviderModels("codex");

        expect(result.error).toBeNull();
        const ids = result.models.map((model) => model.id);
        expect(ids.some((id) => id.includes("codex"))).toBe(true);
      } finally {
        await ctx.cleanup();
      }
    },
    180_000,
  );

  describe("OpenCode catalog", () => {
    beforeEach((context) => {
      if (!hasUsableOpenCodeCatalog) {
        context.skip();
      }
    });

    test("returns models from multiple providers", async () => {
      const ctx = await createDaemonTestContext();
      try {
        const result = await ctx.client.listProviderModels("opencode");

        expect(result.error).toBeNull();
        expect(result.models.length).toBeGreaterThan(0);

        for (const model of result.models) {
          expect(model.provider).toBe("opencode");
          expect(model.id).toContain("/");
          expect(model.label).toBeTruthy();
          expect(model.metadata).toBeDefined();
          expect(model.metadata?.providerId).toBeTruthy();
          expect(model.metadata?.modelId).toBeTruthy();
        }

        const providerIds = new Set(result.models.map((m) => m.metadata?.providerId));
        expect(providerIds.size).toBeGreaterThan(0);
      } finally {
        await ctx.cleanup();
      }
    }, 180_000);
  });
});
