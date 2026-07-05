import { describe, expect, it } from "vitest";
import { buildFinalizeUnwrapArgs, getPublicDecryptClearAmount } from "../src/lib/unwrap";

describe("unwrap finalization helpers", () => {
  it("extracts a clear amount from public decrypt results by handle", () => {
    const handle = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(getPublicDecryptClearAmount({ [handle]: 42n }, handle)).toBe(42n);
  });

  it("builds finalizeUnwrap arguments with normalized proof bytes", () => {
    const args = buildFinalizeUnwrapArgs({
      unwrapRequestId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      clearAmount: "42",
      decryptionProof: "abcd",
    });
    expect(args).toEqual([
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      42n,
      "0xabcd",
    ]);
  });

  it("rejects missing public decryption proof bytes", () => {
    expect(() => buildFinalizeUnwrapArgs({
      unwrapRequestId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      clearAmount: "42",
      decryptionProof: "",
    })).toThrow(/proof/i);
  });

  it("rejects an empty 0x public decryption proof", () => {
    expect(() => buildFinalizeUnwrapArgs({
      unwrapRequestId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      clearAmount: "42",
      decryptionProof: "0x",
    })).toThrow(/proof/i);
  });

  it("rejects negative bigint clear amounts", () => {
    expect(() => buildFinalizeUnwrapArgs({
      unwrapRequestId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      clearAmount: -1n,
      decryptionProof: "0xabcd",
    })).toThrow(/clear amount/i);
  });
});
