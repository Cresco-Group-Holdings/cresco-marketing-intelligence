import { ALLOCATION_TYPES, RANDOMISATION_DISCLAIMER } from "./constants";

export type AllocationInput = {
  allocationType: string;
  weights?: Record<string, number>;
  providerNativeSplit?: boolean;
};

export function buildAllocationPlan(
  variantIds: string[],
  input: AllocationInput,
): {
  weights: Record<string, number>;
  randomisationDisclaimer: string;
  providerNativeSplit: boolean;
} {
  if (!(ALLOCATION_TYPES as readonly string[]).includes(input.allocationType)) {
    throw new Error(`Invalid allocation type: ${input.allocationType}`);
  }

  let weights: Record<string, number> = {};

  if (input.allocationType === "EQUAL") {
    const share = Math.floor(100 / variantIds.length);
    for (const id of variantIds) weights[id] = share;
  } else if (input.allocationType === "WEIGHTED" && input.weights) {
    weights = { ...input.weights };
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error("Weighted allocation must sum to 100%.");
    }
  } else if (input.allocationType === "PROVIDER_NATIVE") {
    weights = Object.fromEntries(variantIds.map((id) => [id, 0]));
  } else if (input.allocationType === "SEQUENTIAL") {
    weights = Object.fromEntries(variantIds.map((id, i) => [id, i === 0 ? 100 : 0]));
  } else if (input.allocationType === "MANUAL") {
    weights = input.weights ?? Object.fromEntries(variantIds.map((id) => [id, 0]));
  }

  const disclaimer =
    input.allocationType === "PROVIDER_NATIVE"
      ? "Provider-native split — platform controls delivery allocation."
      : input.allocationType === "SEQUENTIAL"
        ? "Sequential test — variants run one at a time, not concurrently."
        : RANDOMISATION_DISCLAIMER;

  return {
    weights,
    randomisationDisclaimer: disclaimer,
    providerNativeSplit: input.allocationType === "PROVIDER_NATIVE" || (input.providerNativeSplit ?? false),
  };
}
