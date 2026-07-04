import { describe, expect, it } from "vitest";
import { formatRawAmount, parseDecimalAmount, planWrapAmount } from "../src/lib/amounts";

describe("amount helpers", () => {
  it("parses decimals into raw units", () => {
    expect(parseDecimalAmount("1.25", 6)).toBe(1_250_000n);
    expect(parseDecimalAmount("10", 6)).toBe(10_000_000n);
  });

  it("rejects too many decimal places", () => {
    expect(() => parseDecimalAmount("1.1234567", 6)).toThrow(/more than 6/);
  });

  it("plans wrapper rounding and refund", () => {
    const plan = planWrapAmount("1.234567890123456789", 18, 6);
    expect(plan.confidentialUnits).toBe(1_234_567n);
    expect(plan.refundRaw).toBe(890_123_456_789n);
  });

  it("formats raw units", () => {
    expect(formatRawAmount(1_250_000n, 6)).toBe("1.25");
  });
});
