export function validateBudgetDates(plannedStart?: Date | null, plannedEnd?: Date | null): string[] {
  const errors: string[] = [];
  if (plannedStart && plannedEnd && plannedEnd <= plannedStart) {
    errors.push("Planned end must be after planned start.");
  }
  if (plannedEnd && plannedEnd < new Date()) {
    errors.push("Planned end date is in the past.");
  }
  return errors;
}

export function requiresBudgetApproval(
  amount: number,
  threshold: number,
): boolean {
  return amount >= threshold;
}

export function validateCurrencyPreservation(
  planCurrency: string,
  budgetCurrency: string,
): boolean {
  return planCurrency === budgetCurrency;
}
