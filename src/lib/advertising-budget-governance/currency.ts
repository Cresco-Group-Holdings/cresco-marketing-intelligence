export type FxRate = {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: Date;
  source: string;
};

export type CurrencyConversionInput = {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rates: FxRate[];
};

export type CurrencyConversionResult = {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  reportingCurrency: string;
  fxRate: number | null;
  fxRateDate: Date | null;
  fxRateSource: string | null;
  fxRateMissing: boolean;
  warnings: string[];
};

export type CrossProviderTotalInput = {
  observations: Array<{ amount: number; currency: string; provider: string }>;
  reportingCurrency: string;
  rates: FxRate[];
};

export type CrossProviderTotalResult = {
  reportingCurrency: string;
  total: number;
  lineItems: Array<{
    provider: string;
    originalAmount: number;
    originalCurrency: string;
    convertedAmount: number;
    fxRate: number | null;
    fxRateDate: Date | null;
    fxRateSource: string | null;
    fxRateMissing: boolean;
  }>;
  missingRateWarnings: string[];
};

function findRate(rates: FxRate[], from: string, to: string): FxRate | undefined {
  if (from === to) return { fromCurrency: from, toCurrency: to, rate: 1, rateDate: new Date(), source: "identity" };
  return rates.find((r) => r.fromCurrency === from && r.toCurrency === to);
}

export function convertCurrency(input: CurrencyConversionInput): CurrencyConversionResult {
  const warnings: string[] = [];
  const { amount, fromCurrency, toCurrency, rates } = input;

  if (fromCurrency === toCurrency) {
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      reportingCurrency: toCurrency,
      fxRate: 1,
      fxRateDate: new Date(),
      fxRateSource: "identity",
      fxRateMissing: false,
      warnings,
    };
  }

  const rate = findRate(rates, fromCurrency, toCurrency);
  if (!rate) {
    warnings.push(`Missing FX rate for ${fromCurrency} → ${toCurrency}. Amount excluded from cross-provider totals.`);
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: 0,
      reportingCurrency: toCurrency,
      fxRate: null,
      fxRateDate: null,
      fxRateSource: null,
      fxRateMissing: true,
      warnings,
    };
  }

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount: Math.round(amount * rate.rate * 1_000_000) / 1_000_000,
    reportingCurrency: toCurrency,
    fxRate: rate.rate,
    fxRateDate: rate.rateDate,
    fxRateSource: rate.source,
    fxRateMissing: false,
    warnings,
  };
}

export function aggregateCrossProviderSpend(input: CrossProviderTotalInput): CrossProviderTotalResult {
  const missingRateWarnings: string[] = [];
  const lineItems = input.observations.map((obs) => {
    const conversion = convertCurrency({
      amount: obs.amount,
      fromCurrency: obs.currency,
      toCurrency: input.reportingCurrency,
      rates: input.rates,
    });
    if (conversion.fxRateMissing) {
      missingRateWarnings.push(
        `Provider ${obs.provider}: missing FX rate for ${obs.currency} → ${input.reportingCurrency}.`,
      );
    }
    return {
      provider: obs.provider,
      originalAmount: obs.amount,
      originalCurrency: obs.currency,
      convertedAmount: conversion.convertedAmount,
      fxRate: conversion.fxRate,
      fxRateDate: conversion.fxRateDate,
      fxRateSource: conversion.fxRateSource,
      fxRateMissing: conversion.fxRateMissing,
    };
  });

  const total = lineItems.reduce((sum, item) => sum + item.convertedAmount, 0);

  return {
    reportingCurrency: input.reportingCurrency,
    total: Math.round(total * 1_000_000) / 1_000_000,
    lineItems,
    missingRateWarnings,
  };
}

export function detectCurrencyMismatch(
  accountCurrency: string,
  expectedCurrency: string,
): { mismatch: boolean; message: string | null } {
  if (accountCurrency === expectedCurrency) return { mismatch: false, message: null };
  return {
    mismatch: true,
    message: `Account currency (${accountCurrency}) does not match expected (${expectedCurrency}).`,
  };
}
