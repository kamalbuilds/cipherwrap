import { describe, expect, it } from "vitest";
import { getPairSafety, summarizeRegistryState, type RegistryPair, type RegistryStatus } from "../src/lib/registry";

const confirmedPair: RegistryPair = {
  name: "Confirmed Confidential USDC",
  symbol: "cUSDC",
  wrapper: "0x0000000000000000000000000000000000000002",
  underlying: "0x0000000000000000000000000000000000000001",
  mintable: true,
  isValid: true,
  source: "merged",
  index: 0,
};

describe("registry safety helpers", () => {
  it("blocks write actions until the onchain registry confirms the pair", () => {
    const safety = getPairSafety({ ...confirmedPair, source: "docs" }, "fallback");
    expect(safety.canWrite).toBe(false);
    expect(safety.reason).toMatch(/registry/i);
  });

  it("blocks revoked registry pairs even when the registry loaded", () => {
    const safety = getPairSafety({ ...confirmedPair, isValid: false }, "live");
    expect(safety.canWrite).toBe(false);
    expect(safety.badge).toBe("Revoked");
  });

  it("allows valid onchain-confirmed pairs when the registry is live", () => {
    const safety = getPairSafety(confirmedPair, "live");
    expect(safety.canWrite).toBe(true);
    expect(safety.badge).toBe("Registry valid");
  });

  it("summarizes fallback and invalid registry states for user-facing error UX", () => {
    const state: RegistryStatus = { kind: "fallback", error: "RPC timeout" };
    const summary = summarizeRegistryState([confirmedPair, { ...confirmedPair, wrapper: "0x0000000000000000000000000000000000000003", isValid: false }], state);
    expect(summary.title).toMatch(/Registry fallback/i);
    expect(summary.detail).toMatch(/RPC timeout/);
    expect(summary.invalidCount).toBe(1);
    expect(summary.tone).toBe("warn");
  });
});
