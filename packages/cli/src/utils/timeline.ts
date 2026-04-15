import type { AgentTimelineItem, DaemonClient } from "@getpaseo/server/client";

type FetchProjectedTimelineItemsInput = {
  client: DaemonClient;
  agentId: string;
  limit?: number;
};

export async function fetchProjectedTimelineItems(
  input: FetchProjectedTimelineItemsInput,
): Promise<AgentTimelineItem[]> {
  if (input.limit === 0) {
    return [];
  }

  const timeline = await input.client.fetchAgentTimeline(input.agentId, {
    direction: "tail",
    limit: 0,
    projection: "projected",
  });

  const items = timeline.entries.map((entry) => entry.item);
  return typeof input.limit === "number" ? items.slice(-input.limit) : items;
}
