import type { AgentTimelineItem, DaemonClient } from "@getpaseo/server/client";

type FetchProjectedTimelineItemsInput = {
  client: DaemonClient;
  agentId: string;
  limit?: number;
};

export async function fetchProjectedTimelineItems(
  input: FetchProjectedTimelineItemsInput,
): Promise<AgentTimelineItem[]> {
  const timeline = await input.client.fetchAgentTimeline(input.agentId, {
    direction: "tail",
    limit: input.limit ?? 0,
    projection: "projected",
  });
  return timeline.entries.map((entry) => entry.item);
}
