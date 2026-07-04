export type AmountPlan = {
  requestedRaw: bigint;
  roundedRaw: bigint;
  refundRaw: bigint;
  confidentialUnits: bigint;
  rate: bigint;
};

export function parseDecimalAmount(input: string, decimals = 6): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a positive decimal amount.");
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) throw new Error(`Amount has more than ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac.padEnd(decimals, "0") || "0"));
}

export function planWrapAmount(input: string, underlyingDecimals: number, confidentialDecimals: number): AmountPlan {
  if (underlyingDecimals < confidentialDecimals) throw new Error("Underlying decimals must be greater than or equal to confidential decimals.");
  const rate = 10n ** BigInt(underlyingDecimals - confidentialDecimals);
  const requestedRaw = parseDecimalAmount(input, underlyingDecimals);
  const roundedRaw = requestedRaw - (requestedRaw % rate);
  const refundRaw = requestedRaw - roundedRaw;
  const confidentialUnits = roundedRaw / rate;
  return { requestedRaw, roundedRaw, refundRaw, confidentialUnits, rate };
}

export function formatRawAmount(value: bigint, decimals = 6): string {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
