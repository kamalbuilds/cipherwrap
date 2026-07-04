import { BrowserProvider } from "ethers";

type EncryptedInputBuilder = {
  add8: (value: number) => EncryptedInputBuilder;
  add64: (value: bigint) => EncryptedInputBuilder;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
};

type Relayer = {
  initSDK: () => Promise<void>;
  createInstance: (config: unknown) => Promise<{
    createEncryptedInput: (contractAddress: string, userAddress: string) => EncryptedInputBuilder;
    publicDecrypt: (handles: string[]) => Promise<Record<string, bigint | number | string>>;
  }>;
  SepoliaConfig: Record<string, unknown>;
};

export async function createFheInstance(provider: BrowserProvider) {
  const relayer = (await import("@zama-fhe/relayer-sdk/web")) as unknown as Relayer;
  await relayer.initSDK();
  return relayer.createInstance({ ...relayer.SepoliaConfig, network: provider });
}

export function bytesToHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}
