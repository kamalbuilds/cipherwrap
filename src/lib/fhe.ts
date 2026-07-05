type EncryptedInputBuilder = {
  add8: (value: number) => EncryptedInputBuilder;
  add64: (value: bigint) => EncryptedInputBuilder;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
};

type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; isRabby?: boolean };

type Relayer = {
  initSDK: () => Promise<void>;
  createInstance: (config: unknown) => Promise<{
    createEncryptedInput: (contractAddress: string, userAddress: string) => EncryptedInputBuilder;
    publicDecrypt: (handles: string[]) => Promise<Record<string, bigint | number | string>>;
    generateKeypair?: () => { privateKey: string; publicKey: string };
    createEIP712?: (publicKey: string, contractAddresses: string[], startTimestamp: number, durationDays: number) => { domain: never; types: never; message: never };
    userDecrypt?: (
      handles: Array<{ handle: string; contractAddress: string }>,
      privateKey: string,
      publicKey: string,
      signature: string,
      contractAddresses: string[],
      userAddress: string,
      startTimestamp: number,
      durationDays: number,
    ) => Promise<Record<string, bigint | number | string>>;
  }>;
  SepoliaConfig: Record<string, unknown>;
};

function isEip1193Provider(value: unknown): value is Eip1193Provider {
  return Boolean(value && typeof value === "object" && "request" in value && typeof (value as { request?: unknown }).request === "function");
}

function getBrowserWalletProvider(): Eip1193Provider | undefined {
  const w = window as unknown as { rabby?: Eip1193Provider; ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] } };
  return w.rabby ?? w.ethereum?.providers?.find((provider) => provider.isRabby) ?? w.ethereum;
}

export async function createFheInstance(networkInput?: unknown) {
  const relayer = (await import("@zama-fhe/relayer-sdk/web")) as unknown as Relayer;
  await relayer.initSDK();

  const fallbackRpc = "https://ethereum-sepolia-rpc.publicnode.com";
  const network = typeof networkInput === "string" ? networkInput : fallbackRpc;

  return relayer.createInstance({ ...relayer.SepoliaConfig, network });
}

export function bytesToHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}
