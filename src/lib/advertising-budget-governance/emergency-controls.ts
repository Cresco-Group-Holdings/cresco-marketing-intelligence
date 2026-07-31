export type EmergencyControlType =
  | "EMERGENCY_PAUSE"
  | "PROVIDER_MUTATION_SHUTDOWN"
  | "ORGANISATION_FREEZE"
  | "ACCOUNT_FREEZE";

export type EmergencyControlState = {
  emergencyPauseActive: boolean;
  providerMutationShutdown: boolean;
  organisationFreeze: boolean;
  accountFreeze: boolean;
  activeIncidents: Array<{ type: EmergencyControlType; reason: string; scopeId?: string }>;
};

export type EmergencyActionInput = {
  controlType: EmergencyControlType;
  reason: string;
  provider?: string;
  scopeType?: string;
  scopeId?: string;
};

export function createInitialEmergencyState(): EmergencyControlState {
  return {
    emergencyPauseActive: false,
    providerMutationShutdown: false,
    organisationFreeze: false,
    accountFreeze: false,
    activeIncidents: [],
  };
}

export function applyEmergencyControl(
  state: EmergencyControlState,
  input: EmergencyActionInput,
): EmergencyControlState {
  const incident = { type: input.controlType, reason: input.reason, scopeId: input.scopeId };
  const next = { ...state, activeIncidents: [...state.activeIncidents, incident] };

  switch (input.controlType) {
    case "EMERGENCY_PAUSE":
      next.emergencyPauseActive = true;
      break;
    case "PROVIDER_MUTATION_SHUTDOWN":
      next.providerMutationShutdown = true;
      break;
    case "ORGANISATION_FREEZE":
      next.organisationFreeze = true;
      break;
    case "ACCOUNT_FREEZE":
      next.accountFreeze = true;
      break;
  }

  return next;
}

export function canMutateBudget(state: EmergencyControlState): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (state.emergencyPauseActive) blockers.push("Emergency pause is active.");
  if (state.providerMutationShutdown) blockers.push("Provider mutation shutdown is active.");
  if (state.organisationFreeze) blockers.push("Organisation-level advertising freeze is active.");
  if (state.accountFreeze) blockers.push("Account-level freeze is active.");
  return { allowed: blockers.length === 0, blockers };
}

export function validateRestoration(
  state: EmergencyControlState,
  restorationApproved: boolean,
): { allowed: boolean; reason: string } {
  const hasActive = state.activeIncidents.length > 0;
  if (!hasActive) return { allowed: true, reason: "No active incidents." };
  if (!restorationApproved) {
    return { allowed: false, reason: "Restoration requires explicit approval when incidents are active." };
  }
  return { allowed: true, reason: "Restoration approved." };
}

export function resolveEmergencyState(state: EmergencyControlState): EmergencyControlState {
  return createInitialEmergencyState();
}
