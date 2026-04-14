export {
  DaemonClient,
  type DaemonClientConfig,
  type ConnectionState,
  type DaemonEvent,
} from "../client/daemon-client.js";

export type {
  AgentSnapshotPayload,
  AgentStreamEventPayload,
  AgentStreamMessage,
} from "../shared/messages.js";

export type {
  AgentMode,
  AgentPermissionRequest,
  AgentTimelineItem,
} from "./agent/agent-sdk-types.js";
