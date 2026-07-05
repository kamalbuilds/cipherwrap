import type { BrowserProvider } from "ethers";
import { createFheInstance } from "./fhe";

export type UserDecryptRequest = {
  handle: `0x${string}`;
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  durationDays?: number;
};

type FheUserDecryptInstance = Awaited<ReturnType<typeof createFheInstance>> & {
  generateKeypair: () => { privateKey: string; publicKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ) => { domain: Record<string, unknown>; types: Record<string, Array<{ name: string; type: string }>>; message: Record<string, unknown> };
  userDecrypt: (
    handles: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ) => Promise<Record<string, bigint | string | number>>;
};

export function signingTypesWithoutDomain(types: Record<string, Array<{ name: string; type: string }>>) {
  const { EIP712Domain: _eip712Domain, ...signingTypes } = types;
  return signingTypes;
}

export async function userDecryptHandle(provider: BrowserProvider, request: UserDecryptRequest) {
  const signer = await provider.getSigner();
  const fhe = (await createFheInstance(provider)) as FheUserDecryptInstance;
  const keypair = fhe.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = request.durationDays ?? 1;
  const contractAddresses = [request.contractAddress];
  const typedData = fhe.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
  // ethers v6 derives EIP712Domain from `domain` and requires a single primary type,
  // so the Zama-provided EIP712Domain entry must be removed before signing.
  const signature = await signer.signTypedData(typedData.domain, signingTypesWithoutDomain(typedData.types), typedData.message);
  return fhe.userDecrypt(
    [{ handle: request.handle, contractAddress: request.contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    contractAddresses,
    request.userAddress,
    startTimestamp,
    durationDays,
  );
}
