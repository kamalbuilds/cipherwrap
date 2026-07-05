import { describe, expect, it } from "vitest";
import { signingTypesWithoutDomain } from "../src/lib/decryption";

describe("user decryption EIP-712 signing", () => {
  it("removes EIP712Domain so ethers can infer a single primary type", () => {
    const types = signingTypesWithoutDomain({
      EIP712Domain: [{ name: "name", type: "string" }],
      UserDecryptRequestVerification: [{ name: "publicKey", type: "bytes" }],
    });
    expect(types).toEqual({ UserDecryptRequestVerification: [{ name: "publicKey", type: "bytes" }] });
  });
});
