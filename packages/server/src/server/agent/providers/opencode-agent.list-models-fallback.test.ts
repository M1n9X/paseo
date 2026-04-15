import { afterEach, describe, expect, test, vi } from "vitest";
import os from "node:os";

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: vi.fn(),
}));

import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

import { createTestLogger } from "../../../test-utils/test-logger.js";
import { OpenCodeAgentClient, OpenCodeServerManager } from "./opencode-agent.js";

describe("OpenCodeAgentClient.listModels fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("retries model discovery from a neutral directory when the current cwd has broken OpenCode config", async () => {
    const providerList = vi.fn(async ({ directory }: { directory: string }) => {
      if (directory === process.cwd()) {
        return {
          error: {
            message: "Cannot find module '/broken/project/provider.js'",
          },
        };
      }

      return {
        data: {
          connected: ["openai"],
          all: [
            {
              id: "openai",
              name: "OpenAI",
              models: {
                "gpt-5": {
                  name: "GPT-5",
                  limit: { context: 400_000 },
                },
              },
            },
          ],
        },
      };
    });

    vi.mocked(createOpencodeClient).mockImplementation(
      ({ directory }: { directory: string }) =>
        ({
          directory,
          provider: {
            list: providerList,
          },
        }) as never,
    );

    vi.spyOn(OpenCodeServerManager, "getInstance").mockReturnValue({
      ensureRunning: vi.fn().mockResolvedValue({ port: 1234, url: "http://127.0.0.1:1234" }),
    } as never);

    const client = new OpenCodeAgentClient(createTestLogger());
    await expect(client.listModels()).resolves.toMatchObject([
      {
        provider: "opencode",
        id: "openai/gpt-5",
        label: "GPT-5",
      },
    ]);

    expect(providerList).toHaveBeenCalledTimes(2);
    expect(providerList).toHaveBeenNthCalledWith(1, { directory: process.cwd() });
    expect(providerList).toHaveBeenNthCalledWith(2, { directory: os.tmpdir() });
  });
});
