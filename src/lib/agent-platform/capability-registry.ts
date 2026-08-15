import type { AICapability } from "@prisma/client";
import { aiModelRegistry } from "@/lib/ai/model-registry";

export type AgentModelCapability = {
  capability: AICapability;
  label: string;
  requiredForAgents: boolean;
};

export const AGENT_REQUIRED_CAPABILITIES: AgentModelCapability[] = [
  { capability: "TEXT_GENERATION", label: "Text generation", requiredForAgents: true },
  { capability: "STRUCTURED_OUTPUT", label: "Structured output", requiredForAgents: true },
];

export function listAgentCapableModels() {
  const required = AGENT_REQUIRED_CAPABILITIES.filter((entry) => entry.requiredForAgents).map(
    (entry) => entry.capability,
  );
  return aiModelRegistry.listModels().filter((model) =>
    required.every((capability) => model.capabilities.includes(capability)),
  );
}

export function resolveAgentModel(modelId?: string) {
  const capable = listAgentCapableModels();
  if (modelId) {
    const selected = capable.find((model) => model.modelId === modelId);
    if (selected) return selected;
  }
  return capable.find((model) => model.available) ?? capable[0];
}
