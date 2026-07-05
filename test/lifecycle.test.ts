import { describe, expect, it } from "vitest";
import { buildEtherscanTxUrl, initialLifecycleState, lifecycleReducer, summarizeLifecycle } from "../src/lib/lifecycle";

const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("lifecycle reducer", () => {
  it("adds submitted transactions with Sepolia Etherscan links", () => {
    const next = lifecycleReducer(initialLifecycleState(), {
      type: "txSubmitted",
      step: "wrap",
      txHash,
      message: "Wrap transaction submitted.",
    });

    expect(next.steps.wrap.status).toBe("submitted");
    expect(next.steps.wrap.txHash).toBe(txHash);
    expect(next.history[0]).toMatchObject({
      label: "Wrap",
      status: "submitted",
      href: buildEtherscanTxUrl(txHash),
    });
  });

  it("carries a submitted transaction hash into confirmed history", () => {
    const submitted = lifecycleReducer(initialLifecycleState(), {
      type: "txSubmitted",
      step: "mint",
      txHash,
      message: "Mint transaction submitted.",
    });
    const confirmed = lifecycleReducer(submitted, {
      type: "txConfirmed",
      step: "mint",
      message: "Mint confirmed.",
    });

    expect(confirmed.steps.mint.status).toBe("confirmed");
    expect(confirmed.history[0].href).toBe(buildEtherscanTxUrl(txHash));
  });

  it("summarizes confirmed and verified steps as completed", () => {
    const minted = lifecycleReducer(initialLifecycleState(), { type: "txConfirmed", step: "mint", txHash, message: "Mint confirmed." });
    const decrypted = lifecycleReducer(minted, { type: "verified", step: "userDecrypt", message: "Balance decrypted." });

    expect(summarizeLifecycle(decrypted)).toEqual({ completed: 2, failed: 0, total: 6 });
  });

  it("resets active step status without clearing transaction history", () => {
    const state = lifecycleReducer(initialLifecycleState(), { type: "verified", step: "userDecrypt", message: "Balance decrypted." });
    const reset = lifecycleReducer(state, { type: "resetActive", message: "Selected cUSDCMock." });

    expect(reset.steps.userDecrypt.status).toBe("ready");
    expect(reset.history).toHaveLength(1);
    expect(reset.banner).toBe("Selected cUSDCMock.");
  });

  it("rejects malformed transaction hashes", () => {
    expect(() => buildEtherscanTxUrl("0x1234")).toThrow(/transaction hash/i);
  });
});
