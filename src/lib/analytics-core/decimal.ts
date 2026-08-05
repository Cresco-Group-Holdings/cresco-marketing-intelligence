import { Prisma } from "@prisma/client";

export type DecimalInput = Prisma.Decimal | string | number;

export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

export function addDecimal(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).add(toDecimal(b));
}

export function subtractDecimal(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).sub(toDecimal(b));
}

export function divideDecimal(
  numerator: DecimalInput,
  denominator: DecimalInput,
  scale = 8,
): Prisma.Decimal | null {
  const divisor = toDecimal(denominator);
  if (divisor.isZero()) return null;
  return toDecimal(numerator).div(divisor).toDecimalPlaces(scale);
}

export function multiplyDecimal(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).mul(toDecimal(b));
}

export function percentOf(part: DecimalInput, whole: DecimalInput, scale = 4): Prisma.Decimal | null {
  const ratio = divideDecimal(part, whole, scale + 2);
  if (!ratio) return null;
  return ratio.mul(100).toDecimalPlaces(scale);
}

export function sumDecimals(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, value) => acc.add(toDecimal(value)), new Prisma.Decimal(0));
}

export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (!value) return null;
  return Number(value.toString());
}
