import { Contract } from "ethers";
import { REGISTRY_ABI, SEPOLIA_WRAPPER_PAIRS, WRAPPERS_REGISTRY, type WrapperPair } from "./contracts";

export type RegistryPair = WrapperPair & {
  isValid: boolean;
  source: "docs" | "onchain" | "merged";
  index?: number;
};

export type RawRegistryPair = {
  tokenAddress: string;
  confidentialTokenAddress: string;
  isValid: boolean;
};

export type RegistryRead = Pick<Contract, "getTokenConfidentialTokenPairsLength" | "getTokenConfidentialTokenPair">;

export async function readOnchainRegistry(providerOrSigner: unknown): Promise<RawRegistryPair[]> {
  const registry = new Contract(WRAPPERS_REGISTRY, REGISTRY_ABI, providerOrSigner as never) as unknown as RegistryRead;
  const length = Number(await registry.getTokenConfidentialTokenPairsLength());
  const pairs: RawRegistryPair[] = [];
  for (let i = 0; i < length; i += 1) {
    const row = await registry.getTokenConfidentialTokenPair(i);
    pairs.push({
      tokenAddress: String(row.tokenAddress),
      confidentialTokenAddress: String(row.confidentialTokenAddress),
      isValid: Boolean(row.isValid),
    });
  }
  return pairs;
}

export function mergeRegistryPairs(docsPairs: WrapperPair[], onchainPairs: RawRegistryPair[]): RegistryPair[] {
  const byWrapper = new Map<string, RegistryPair>();
  for (const pair of docsPairs) {
    byWrapper.set(pair.wrapper.toLowerCase(), { ...pair, isValid: true, source: "docs" });
  }
  onchainPairs.forEach((row, index) => {
    const key = row.confidentialTokenAddress.toLowerCase();
    const known = byWrapper.get(key);
    if (known) {
      byWrapper.set(key, {
        ...known,
        underlying: row.tokenAddress as `0x${string}`,
        wrapper: row.confidentialTokenAddress as `0x${string}`,
        isValid: row.isValid,
        source: "merged",
        index,
      });
      return;
    }
    byWrapper.set(key, {
      name: "Registry pair",
      symbol: shortSymbol(row.confidentialTokenAddress),
      wrapper: row.confidentialTokenAddress as `0x${string}`,
      underlying: row.tokenAddress as `0x${string}`,
      mintable: false,
      isValid: row.isValid,
      source: "onchain",
      index,
    });
  });
  return [...byWrapper.values()].sort((a, b) => Number(b.isValid) - Number(a.isValid) || a.symbol.localeCompare(b.symbol));
}

export function docsRegistryPairs(): RegistryPair[] {
  return SEPOLIA_WRAPPER_PAIRS.map((pair) => ({ ...pair, isValid: true, source: "docs" }));
}

export function shortSymbol(address: string) {
  return `cToken ${address.slice(2, 6)}`;
}

export function registryCoverage(pairs: RegistryPair[]) {
  return {
    total: pairs.length,
    valid: pairs.filter((pair) => pair.isValid).length,
    mintable: pairs.filter((pair) => pair.mintable).length,
    onchainBacked: pairs.filter((pair) => pair.source === "merged" || pair.source === "onchain").length,
  };
}
