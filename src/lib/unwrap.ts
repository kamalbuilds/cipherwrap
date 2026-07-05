import { Interface, type TransactionReceipt } from "ethers";

export const UNWRAP_EVENTS = [
  "event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)",
  "event UnwrapFinalized(bytes32 indexed unwrapRequestId, uint64 amount)",
] as const;

const iface = new Interface(UNWRAP_EVENTS);

export type UnwrapRequestEvent = {
  receiver: string;
  unwrapRequestId: string;
  amountHandle: string;
};

export type FinalizeUnwrapInput = {
  unwrapRequestId: string;
  clearAmount: string | number | bigint;
  decryptionProof: string;
};

export function findUnwrapRequest(receipt: TransactionReceipt): UnwrapRequestEvent | null {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name !== "UnwrapRequested") continue;
      return {
        receiver: String(parsed.args.receiver),
        unwrapRequestId: String(parsed.args.unwrapRequestId),
        amountHandle: String(parsed.args.amount),
      };
    } catch {
      // Ignore logs from unrelated contracts.
    }
  }
  return null;
}

function normalizeHexBytes(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (prefixed === "0x") throw new Error(`${label} is required.`);
  if (!/^0x([0-9a-fA-F]{2})*$/.test(prefixed)) throw new Error(`${label} must be hex bytes.`);
  return prefixed as `0x${string}`;
}

function normalizeBytes32(value: string, label: string) {
  const normalized = normalizeHexBytes(value, label);
  if (normalized.length !== 66) throw new Error(`${label} must be bytes32.`);
  return normalized;
}

function normalizeClearAmount(value: string | number | bigint) {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("Clear amount must be non-negative.");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Clear amount must be a non-negative safe integer.");
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error("Clear amount must be an integer.");
  return BigInt(trimmed);
}

export function getPublicDecryptClearAmount(result: Record<string, bigint | number | string>, amountHandle: string) {
  const exact = result[amountHandle];
  const lower = result[amountHandle.toLowerCase()];
  const value = exact ?? lower;
  if (value === undefined) throw new Error("Public decrypt result did not include the unwrap amount handle.");
  return normalizeClearAmount(value);
}

export function buildFinalizeUnwrapArgs(input: FinalizeUnwrapInput) {
  return [
    normalizeBytes32(input.unwrapRequestId, "Unwrap request id"),
    normalizeClearAmount(input.clearAmount),
    normalizeHexBytes(input.decryptionProof, "Public decryption proof"),
  ] as const;
}
