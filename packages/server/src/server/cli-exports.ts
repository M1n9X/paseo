export {
  AGENT_PROVIDER_DEFINITIONS,
  BUILTIN_PROVIDER_IDS,
  type AgentProviderDefinition,
} from "./agent/provider-manifest.js";

export { curateAgentActivity } from "./agent/activity-curator.js";

export {
  getStructuredAgentResponse,
  StructuredAgentResponseError,
  StructuredAgentFallbackError,
  DEFAULT_STRUCTURED_GENERATION_PROVIDERS,
  generateStructuredAgentResponseWithFallback,
  type AgentCaller,
  type JsonSchema,
  type StructuredGenerationAttempt,
  type StructuredGenerationProvider,
  type StructuredAgentGenerationOptions,
  type StructuredAgentGenerationWithFallbackOptions,
  type StructuredAgentResponseOptions,
} from "./agent/agent-response-loop.js";

export { generateLocalPairingOffer, type LocalPairingOffer } from "./pairing-offer.js";
export { getOrCreateServerId } from "./server-id.js";
export {
  applyProviderEnv,
  type ProviderOverride,
  type ProviderProfileModel,
} from "./agent/provider-launch-config.js";
export {
  findExecutable,
  quoteWindowsArgument,
  quoteWindowsCommand,
} from "../utils/executable.js";
export { execCommand, spawnProcess } from "../utils/spawn.js";
