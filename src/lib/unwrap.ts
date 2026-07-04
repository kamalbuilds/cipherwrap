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
