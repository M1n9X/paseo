import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnSyncMock, randomUUIDMock, userInfoMock, writeSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
  randomUUIDMock: vi.fn(() => "12345678-1234-1234-1234-1234567890ab"),
  userInfoMock: vi.fn(() => ({ shell: "/bin/zsh" })),
  writeSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

vi.mock("node:os", () => ({
  userInfo: userInfoMock,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeSync: writeSyncMock,
  };
});

function restoreProcessProperty(
  key: "platform" | "execPath",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(process, key, descriptor);
    return;
  }

  delete (process as NodeJS.Process & Partial<Record<typeof key, unknown>>)[key];
}

describe("login-shell-env", () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const originalExecPath = Object.getOwnPropertyDescriptor(process, "execPath");
  const originalArgv = process.argv;
  const originalShell = process.env.SHELL;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "",
    });
    writeSyncMock.mockReturnValue(0);

    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    Object.defineProperty(process, "execPath", {
      value: "/Applications/Paseo.app/Contents/MacOS/Paseo",
      configurable: true,
    });
    process.env.SHELL = "/bin/zsh";
  });

  afterEach(() => {
    restoreProcessProperty("platform", originalPlatform);
    restoreProcessProperty("execPath", originalExecPath);
    process.argv = originalArgv;
    if (originalShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = originalShell;
    }
  });

  it("probes login-shell env with the packaged macOS Helper executable", async () => {
    const { inheritLoginShellEnv } = await import("./login-shell-env");

    inheritLoginShellEnv();

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock.mock.calls[0]?.[0]).toBe("/bin/zsh");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "-i",
      "-l",
      "-c",
      "'/Applications/Paseo.app/Contents/Frameworks/Paseo Helper.app/Contents/MacOS/Paseo Helper' -p '\"123456781234\" + JSON.stringify(process.env) + \"123456781234\"'",
    ]);
  });

  it("detects shell-env probe launches from Electron argv", async () => {
    const { getShellEnvProbeMarker } = await import("./login-shell-env");

    expect(
      getShellEnvProbeMarker([
        "/Applications/Paseo.app/Contents/Frameworks/Paseo Helper.app/Contents/MacOS/Paseo Helper",
        "-p",
        '"123456781234" + JSON.stringify(process.env) + "123456781234"',
      ]),
    ).toBe("123456781234");

    expect(
      getShellEnvProbeMarker([
        "/Applications/Paseo.app/Contents/Frameworks/Paseo Helper.app/Contents/MacOS/Paseo Helper",
        "-p",
        "'123456781234' + JSON.stringify(process.env) + '123456781234'",
      ]),
    ).toBe("123456781234");

    expect(
      getShellEnvProbeMarker([
        "/Applications/Paseo.app/Contents/MacOS/Paseo",
        "--open-project",
        "/tmp/project",
      ]),
    ).toBeNull();
  });

  it("short-circuits shell-env probe launches by synchronously writing to stdout", async () => {
    const { maybeHandleShellEnvProbeLaunch } = await import("./login-shell-env");

    process.argv = [
      "/Applications/Paseo.app/Contents/Frameworks/Paseo Helper.app/Contents/MacOS/Paseo Helper",
      "-p",
      '"123456781234" + JSON.stringify(process.env) + "123456781234"',
    ];

    expect(maybeHandleShellEnvProbeLaunch()).toBe(true);
    expect(writeSyncMock).toHaveBeenCalledWith(
      process.stdout.fd,
      expect.stringContaining("123456781234"),
    );
  });

  it("recognizes PowerShell-style single-quoted probe launches", async () => {
    const { maybeHandleShellEnvProbeLaunch } = await import("./login-shell-env");

    process.argv = [
      "/Applications/Paseo.app/Contents/Frameworks/Paseo Helper.app/Contents/MacOS/Paseo Helper",
      "-p",
      "'123456781234' + JSON.stringify(process.env) + '123456781234'",
    ];

    expect(maybeHandleShellEnvProbeLaunch()).toBe(true);
    expect(writeSyncMock).toHaveBeenCalledWith(
      process.stdout.fd,
      expect.stringContaining("123456781234"),
    );
  });
});
