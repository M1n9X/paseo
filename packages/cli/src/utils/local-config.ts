import { existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_PORT = 6767;
const DEFAULT_RELAY_ENDPOINT = "relay.paseo.sh:443";
const DEFAULT_APP_BASE_URL = "https://app.paseo.sh";
const CONFIG_FILENAME = "config.json";

export type CliConfigOverrides = Partial<{
  listen: string;
  relayEnabled: boolean;
  mcpEnabled: boolean;
  mcpInjectIntoAgents: boolean;
  allowedHosts: boolean | string[];
}>;

export type PersistedCliConfig = {
  daemon?: {
    listen?: unknown;
    relay?: {
      enabled?: unknown;
      endpoint?: unknown;
      publicEndpoint?: unknown;
    };
  };
  app?: {
    baseUrl?: unknown;
  };
  features?: {
    dictation?: {
      enabled?: boolean;
    };
    voiceMode?: {
      enabled?: boolean;
    };
  };
  [key: string]: unknown;
};

export type ResolvedCliDaemonConfig = {
  listen: string;
  relayEnabled: boolean;
  relayEndpoint: string;
  relayPublicEndpoint: string;
  appBaseUrl: string;
};

function expandHomeDir(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  if (input === "~") {
    return os.homedir();
  }
  return input;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function resolveCliPaseoHome(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PASEO_HOME ?? "~/.paseo";
  const resolved = path.resolve(expandHomeDir(raw));
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function getPersistedConfigPath(paseoHome: string): string {
  return path.join(paseoHome, CONFIG_FILENAME);
}

export function loadPersistedCliConfig(paseoHome: string): PersistedCliConfig {
  const configPath = getPersistedConfigPath(paseoHome);
  if (!existsSync(configPath)) {
    return {};
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Config] Failed to read ${configPath}: ${message}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Config root must be a JSON object");
    }
    return parsed as PersistedCliConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Config] Invalid JSON in ${configPath}: ${message}`);
  }
}

export function resolveCliDaemonConfig(
  paseoHome: string,
  options?: {
    env?: NodeJS.ProcessEnv;
    cli?: CliConfigOverrides;
  },
): ResolvedCliDaemonConfig {
  const env = options?.env ?? process.env;
  const persisted = loadPersistedCliConfig(paseoHome);

  const persistedListen =
    typeof persisted.daemon?.listen === "string" ? persisted.daemon.listen : undefined;
  const listen =
    options?.cli?.listen ??
    env.PASEO_LISTEN ??
    persistedListen ??
    `127.0.0.1:${env.PORT ?? DEFAULT_PORT}`;

  const persistedRelayEnabled =
    typeof persisted.daemon?.relay?.enabled === "boolean"
      ? persisted.daemon.relay.enabled
      : undefined;
  const relayEnabled =
    options?.cli?.relayEnabled ??
    parseBooleanEnv(env.PASEO_RELAY_ENABLED) ??
    persistedRelayEnabled ??
    true;

  const persistedRelayEndpoint =
    typeof persisted.daemon?.relay?.endpoint === "string"
      ? persisted.daemon.relay.endpoint
      : undefined;
  const relayEndpoint =
    env.PASEO_RELAY_ENDPOINT ?? persistedRelayEndpoint ?? DEFAULT_RELAY_ENDPOINT;

  const persistedRelayPublicEndpoint =
    typeof persisted.daemon?.relay?.publicEndpoint === "string"
      ? persisted.daemon.relay.publicEndpoint
      : undefined;
  const relayPublicEndpoint =
    env.PASEO_RELAY_PUBLIC_ENDPOINT ?? persistedRelayPublicEndpoint ?? relayEndpoint;

  const persistedAppBaseUrl =
    typeof persisted.app?.baseUrl === "string" ? persisted.app.baseUrl : undefined;
  const appBaseUrl = env.PASEO_APP_BASE_URL ?? persistedAppBaseUrl ?? DEFAULT_APP_BASE_URL;

  return {
    listen,
    relayEnabled,
    relayEndpoint,
    relayPublicEndpoint,
    appBaseUrl,
  };
}
