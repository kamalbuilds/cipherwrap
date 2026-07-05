import { Contract } from "ethers";
import { REGISTRY_ABI, SEPOLIA_WRAPPER_PAIRS, WRAPPERS_REGISTRY, type WrapperPair } from "./contracts";

export type RegistryPair = WrapperPair & {
  isValid: boolean;
  source: "docs" | "onchain" | "merged";
  index?: number;
};

export type RegistryStatus = "loading" | "live" | { kind: "fallback"; error?: string };

export type PairSafety = {
  badge: "Registry valid" | "Revoked" | "Unconfirmed" | "Registry pending";
  canWrite: boolean;
  canMint: boolean;
  reason: string;
  tone: "success" | "warn" | "danger";
};

export type RegistrySummary = {
  title: string;
  detail: string;
  tone: "success" | "warn" | "danger";
  onchainBacked: number;
  invalidCount: number;
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
    valid: pairs.filter((pair) => isOnchainConfirmed(pair) && pair.isValid).length,
    mintable: pairs.filter((pair) => pair.mintable).length,
    onchainBacked: pairs.filter((pair) => pair.source === "merged" || pair.source === "onchain").length,
  };
}

export function isOnchainConfirmed(pair: RegistryPair) {
  return pair.source === "merged" || pair.source === "onchain";
}

function registryStatusKind(status: RegistryStatus) {
  return typeof status === "string" ? status : status.kind;
}

export function getPairSafety(pair: RegistryPair, status: RegistryStatus): PairSafety {
  if (registryStatusKind(status) === "loading") {
    return {
      badge: "Registry pending",
      canWrite: false,
      canMint: false,
      reason: "Waiting for the onchain registry before enabling write actions.",
      tone: "warn",
    };
  }

  if (registryStatusKind(status) === "fallback" || !isOnchainConfirmed(pair)) {
    return {
      badge: "Unconfirmed",
      canWrite: false,
      canMint: false,
      reason: "Onchain registry confirmation is required before mint, wrap, or unwrap actions.",
      tone: "warn",
    };
  }

  if (!pair.isValid) {
    return {
      badge: "Revoked",
      canWrite: false,
      canMint: false,
      reason: "This pair is revoked or invalid in the onchain registry.",
      tone: "danger",
    };
  }

  return {
    badge: "Registry valid",
    canWrite: true,
    canMint: pair.mintable,
    reason: pair.mintable ? "Onchain registry confirms this wrapper pair." : "Onchain registry confirms this restricted wrapper pair.",
    tone: "success",
  };
}

export function summarizeRegistryState(pairs: RegistryPair[], status: RegistryStatus): RegistrySummary {
  const coverage = registryCoverage(pairs);
  const invalidCount = pairs.filter((pair) => isOnchainConfirmed(pair) && !pair.isValid).length;
  const kind = registryStatusKind(status);

  if (kind === "loading") {
    return {
      title: "Loading registry",
      detail: "Checking Zama Sepolia before enabling write actions.",
      tone: "warn",
      onchainBacked: coverage.onchainBacked,
      invalidCount,
    };
  }

  if (kind === "fallback") {
    const error = typeof status === "string" ? "" : status.error;
    return {
      title: "Registry fallback active",
      detail: `Browsing docs metadata only. Write actions stay locked until the onchain registry responds${error ? `: ${error}` : "."}`,
      tone: "warn",
      onchainBacked: coverage.onchainBacked,
      invalidCount,
    };
  }

  if (coverage.onchainBacked === 0) {
    return {
      title: "Registry returned no pairs",
      detail: "Docs metadata is visible for review, but write actions require an onchain-confirmed pair.",
      tone: "warn",
      onchainBacked: coverage.onchainBacked,
      invalidCount,
    };
  }

  return {
    title: invalidCount ? "Registry live with invalid pairs" : "Registry live",
    detail: `${coverage.onchainBacked} onchain-backed pair(s) loaded. ${invalidCount} revoked or invalid pair(s) are locked from writes.`,
    tone: invalidCount ? "warn" : "success",
    onchainBacked: coverage.onchainBacked,
    invalidCount,
  };
}
