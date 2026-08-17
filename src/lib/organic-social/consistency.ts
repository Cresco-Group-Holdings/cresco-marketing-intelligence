import type { ConsistencyChannelScore } from "@/lib/organic-social/types";

export function calculatePublishingConsistencyScore(input: {
  channels: Array<{
    channel: string;
    published: number;
    scheduled: number;
    periodDays: number;
    connected: boolean;
    targetPostsPerWeek?: number;
  }>;
}): { score: number; channels: ConsistencyChannelScore[] } {
  const activeChannels = input.channels.filter((channel) => channel.connected);
  if (activeChannels.length === 0) {
    return { score: 0, channels: [] };
  }

  const channelScores: ConsistencyChannelScore[] = activeChannels.map((channel) => {
    const targetPerWeek = channel.targetPostsPerWeek ?? 3;
    const expectedInPeriod = (targetPerWeek / 7) * channel.periodDays;
    const actual = channel.published + channel.scheduled * 0.5;
    const ratio = expectedInPeriod > 0 ? actual / expectedInPeriod : 0;

    let label: string;
    let score: number;
    if (ratio >= 1) {
      label = "Strong";
      score = 100;
    } else if (ratio >= 0.7) {
      label = "On track";
      score = Math.round(ratio * 100);
    } else if (ratio >= 0.3) {
      label = "Needs content";
      score = Math.round(ratio * 80);
    } else {
      const gapDays = Math.max(
        0,
        Math.round(expectedInPeriod - actual) * Math.ceil(7 / targetPerWeek),
      );
      label = gapDays > 0 ? `${gapDays}-day gap` : "Needs content";
      score = Math.round(ratio * 60);
    }

    return { channel: channel.channel, label, score };
  });

  const score = Math.round(
    channelScores.reduce((sum, item) => sum + item.score, 0) / channelScores.length,
  );

  return { score, channels: channelScores };
}

export function detectScheduleGaps(input: {
  channels: Array<{
    channel: string;
    connected: boolean;
    scheduledContent: number;
    reelsScheduled: number;
    formatLabel?: string;
  }>;
  gapThresholdDays?: number;
}): Array<{ channel: string; message: string }> {
  const threshold = input.gapThresholdDays ?? 5;
  const gaps: Array<{ channel: string; message: string }> = [];

  for (const channel of input.channels) {
    if (!channel.connected) continue;
    if (channel.scheduledContent === 0) {
      gaps.push({
        channel: channel.channel,
        message: `No ${channel.formatLabel ?? "content"} scheduled for the next ${threshold} days.`,
      });
    } else if (channel.reelsScheduled === 0 && channel.formatLabel === "Reel") {
      gaps.push({
        channel: channel.channel,
        message: `No ${channel.channel} Reel scheduled for the next ${threshold} days.`,
      });
    }
  }

  return gaps;
}
