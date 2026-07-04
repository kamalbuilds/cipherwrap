import { describe, expect, it } from "vitest";
import { docsRegistryPairs, mergeRegistryPairs, registryCoverage } from "../src/lib/registry";

describe("registry merge", () => {
  it("keeps docs metadata while replacing validity from onchain rows", () => {
    const docs = docsRegistryPairs().slice(0, 1);
    const merged = mergeRegistryPairs(docs, [{ tokenAddress: docs[0].underlying, confidentialTokenAddress: docs[0].wrapper, isValid: false }]);
    expect(merged[0].source).toBe("merged");
    expect(merged[0].isValid).toBe(false);
    expect(merged[0].symbol).toBe(docs[0].symbol);
  });

  it("adds unknown onchain pairs", () => {
    const merged = mergeRegistryPairs([], [{ tokenAddress: "0x0000000000000000000000000000000000000001", confidentialTokenAddress: "0x0000000000000000000000000000000000000002", isValid: true }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("onchain");
  });

  it("summarizes coverage", () => {
    const coverage = registryCoverage(docsRegistryPairs());
    expect(coverage.total).toBeGreaterThanOrEqual(8);
    expect(coverage.mintable).toBeGreaterThanOrEqual(7);
  });
});
