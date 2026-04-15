import { beforeAll, beforeEach, describe, test, expect } from "vitest";
import { createDaemonTestContext } from "../test-utils/index.js";
import {
  isBinaryInstalled,
  probeOpenCodeModelCatalog,
} from "../test-utils/opencode-availability.js";

const hasCodex = isBinaryInstalled("codex");

describe("daemon E2E", () => {
  let hasUsableOpenCodeCatalog = false;

  beforeAll(async () => {
    hasUsableOpenCodeCatalog = (await probeOpenCodeModelCatalog()) !== null;
  }, 60_000);

  describe("listProviderModels", () => {
    test.runIf(hasCodex)(
      "returns model list for Codex provider",
      async () => {
        const ctx = await createDaemonTestContext();
        try {
          // List models for Codex provider - no agent needed
          const result = await ctx.client.listProviderModels("codex");

          // Verify response structure
          expect(result.provider).toBe("codex");
          expect(result.error).toBeNull();
          expect(result.fetchedAt).toBeTruthy();

          // Should return at least one model
          expect(result.models).toBeTruthy();
          expect(result.models.length).toBeGreaterThan(0);

          // Verify model structure
          const model = result.models[0];
          expect(model.provider).toBe("codex");
          expect(model.id).toBeTruthy();
          expect(model.label).toBeTruthy();
        } finally {
          await ctx.cleanup();
        }
      },
      60000, // 1 minute timeout
    );

    test("returns model list for Claude provider", async () => {
      const ctx = await createDaemonTestContext();
      try {
        // List models for Claude provider - no agent needed
        const result = await ctx.client.listProviderModels("claude");

        // Verify response structure
        expect(result.provider).toBe("claude");
        expect(result.error).toBeNull();
        expect(result.fetchedAt).toBeTruthy();

        // Should return at least one model
        expect(result.models).toBeTruthy();
        expect(result.models.length).toBeGreaterThan(0);

        // Verify model structure
        const model = result.models[0];
        expect(model.provider).toBe("claude");
        expect(model.id).toBeTruthy();
        expect(model.label).toBeTruthy();
      } finally {
        await ctx.cleanup();
      }
    }, 180000);

    describe("OpenCode provider", () => {
      beforeEach((context) => {
        if (!hasUsableOpenCodeCatalog) {
          context.skip();
        }
      });

      test("returns model list for OpenCode provider", async () => {
        const ctx = await createDaemonTestContext();
        try {
          const result = await ctx.client.listProviderModels("opencode");

          expect(result.provider).toBe("opencode");
          expect(result.error).toBeNull();
          expect(result.fetchedAt).toBeTruthy();

          expect(result.models).toBeTruthy();
          expect(result.models.length).toBeGreaterThan(0);

          const model = result.models[0];
          expect(model.provider).toBe("opencode");
          expect(model.id).toBeTruthy();
          expect(model.label).toBeTruthy();
        } finally {
          await ctx.cleanup();
        }
      }, 60000);
    });
  });
});
