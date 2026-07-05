import { describe, expect, it } from "vitest";
import { WRAPPERS_REGISTRY, type WrapperPair } from "../src/lib/contracts";
import { generateIntegrationSnippet } from "../src/lib/snippets";

const pair: WrapperPair = {
  name: "Confidential USDC",
  symbol: "cUSDCMock",
  wrapper: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
  underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
  mintable: true,
};

describe("integration snippet generator", () => {
  it("generates a registry-first wrap snippet for the selected official pair", () => {
    const snippet = generateIntegrationSnippet(pair);
    expect(snippet).toContain(WRAPPERS_REGISTRY);
    expect(snippet).toContain(pair.wrapper);
    expect(snippet).toContain(pair.underlying);
    expect(snippet).toContain("isConfidentialTokenValid");
    expect(snippet).toContain("wrap");
  });
});
