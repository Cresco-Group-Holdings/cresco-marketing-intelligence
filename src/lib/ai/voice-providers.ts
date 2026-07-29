export type ApprovedVoice = {
  id: "approved-en-us-neutral" | "approved-en-gb-warm";
  language: string;
  accent: string;
  licence: { commercialUse: true; owner: string };
};

export const APPROVED_VOICES: ApprovedVoice[] = [
  {
    id: "approved-en-us-neutral",
    language: "en-US",
    accent: "US neutral",
    licence: { commercialUse: true, owner: "Cresco voice library" },
  },
  {
    id: "approved-en-gb-warm",
    language: "en-GB",
    accent: "UK warm",
    licence: { commercialUse: true, owner: "Cresco voice library" },
  },
];

export interface VoiceProvider {
  estimateDuration(text: string): number;
  preview(
    text: string,
    voiceId: ApprovedVoice["id"],
  ): Promise<{ durationSeconds: number; provider: string }>;
}

export class MockVoiceProvider implements VoiceProvider {
  estimateDuration(text: string) {
    return Math.max(1, Number((text.trim().split(/\s+/).length / 2.5).toFixed(2)));
  }
  async preview(text: string, voiceId: ApprovedVoice["id"]) {
    if (!APPROVED_VOICES.some((voice) => voice.id === voiceId))
      throw new Error("Voice is not approved.");
    return { durationSeconds: this.estimateDuration(text), provider: "MOCK" };
  }
}
