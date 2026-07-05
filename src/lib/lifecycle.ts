export const SEPOLIA_ETHERSCAN_TX_BASE = "https://sepolia.etherscan.io/tx/";

export type LifecycleStepKey = "mint" | "approve" | "wrap" | "userDecrypt" | "unwrapRequest" | "finalizeUnwrap";

export type LifecycleStepStatus = "ready" | "pending" | "submitted" | "confirmed" | "verified" | "failed";

export type LifecycleStep = {
  key: LifecycleStepKey;
  label: string;
  help: string;
};

export const LIFECYCLE_STEPS: LifecycleStep[] = [
  { key: "mint", label: "Mint", help: "Receive public mock tokens for mintable registry pairs." },
  { key: "approve", label: "Approve", help: "Allow the wrapper to spend the selected public token amount." },
  { key: "wrap", label: "Wrap", help: "Convert approved public tokens into confidential ERC-7984 units." },
  { key: "userDecrypt", label: "User decrypt", help: "Sign EIP-712 typed data and decrypt the confidential balance handle." },
  { key: "unwrapRequest", label: "Request unwrap", help: "Submit an encrypted amount and capture the unwrap request id." },
  { key: "finalizeUnwrap", label: "Finalize", help: "Finalize after the public decrypt proof is available." },
];

export type LifecycleStepState = {
  status: LifecycleStepStatus;
  message: string;
  txHash?: string;
};

export type LifecycleHistoryStatus = "started" | "submitted" | "confirmed" | "verified" | "failed" | "info";

export type LifecycleHistoryEntry = {
  id: string;
  step?: LifecycleStepKey;
  label: string;
  status: LifecycleHistoryStatus;
  message: string;
  txHash?: string;
  href?: string;
};

export type LifecycleState = {
  steps: Record<LifecycleStepKey, LifecycleStepState>;
  history: LifecycleHistoryEntry[];
  banner: string;
};

export type LifecycleAction =
  | { type: "note"; message: string; label?: string }
  | { type: "start"; step: LifecycleStepKey; message: string }
  | { type: "txSubmitted"; step: LifecycleStepKey; txHash: string; message: string }
  | { type: "txConfirmed"; step: LifecycleStepKey; txHash?: string; message: string }
  | { type: "verified"; step: LifecycleStepKey; message: string }
  | { type: "failed"; step: LifecycleStepKey; message: string }
  | { type: "resetActive"; message: string };

function blankSteps(): Record<LifecycleStepKey, LifecycleStepState> {
  return LIFECYCLE_STEPS.reduce((acc, step) => {
    acc[step.key] = { status: "ready", message: step.help };
    return acc;
  }, {} as Record<LifecycleStepKey, LifecycleStepState>);
}

export function buildEtherscanTxUrl(txHash: string) {
  const trimmed = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) throw new Error("Transaction hash must be a 32-byte hex string.");
  return `${SEPOLIA_ETHERSCAN_TX_BASE}${trimmed}`;
}

export function initialLifecycleState(banner = "Choose a registry pair, connect a Sepolia wallet, then move through mint, approve, wrap, decrypt, and unwrap."): LifecycleState {
  return {
    steps: blankSteps(),
    history: [],
    banner,
  };
}

function stepLabel(stepKey: LifecycleStepKey) {
  return LIFECYCLE_STEPS.find((step) => step.key === stepKey)?.label ?? stepKey;
}

function appendHistory(state: LifecycleState, entry: Omit<LifecycleHistoryEntry, "id" | "href">): LifecycleHistoryEntry[] {
  const id = `${state.history.length + 1}-${entry.status}-${entry.step ?? "note"}`;
  const href = entry.txHash ? buildEtherscanTxUrl(entry.txHash) : undefined;
  return [{ id, href, ...entry }, ...state.history].slice(0, 12);
}

export function lifecycleReducer(state: LifecycleState, action: LifecycleAction): LifecycleState {
  if (action.type === "note") {
    return {
      ...state,
      banner: action.message,
      history: appendHistory(state, {
        label: action.label ?? "Status",
        status: "info",
        message: action.message,
      }),
    };
  }

  if (action.type === "resetActive") {
    return {
      ...state,
      steps: blankSteps(),
      banner: action.message,
    };
  }

  const previous = state.steps[action.step];
  const nextStepBase = { ...previous, message: action.message };

  if (action.type === "start") {
    return {
      ...state,
      banner: action.message,
      steps: { ...state.steps, [action.step]: { ...nextStepBase, status: "pending" } },
      history: appendHistory(state, {
        step: action.step,
        label: stepLabel(action.step),
        status: "started",
        message: action.message,
      }),
    };
  }

  if (action.type === "txSubmitted") {
    return {
      ...state,
      banner: action.message,
      steps: { ...state.steps, [action.step]: { ...nextStepBase, status: "submitted", txHash: action.txHash } },
      history: appendHistory(state, {
        step: action.step,
        label: stepLabel(action.step),
        status: "submitted",
        message: action.message,
        txHash: action.txHash,
      }),
    };
  }

  if (action.type === "txConfirmed") {
    const txHash = action.txHash ?? previous.txHash;
    return {
      ...state,
      banner: action.message,
      steps: { ...state.steps, [action.step]: { ...nextStepBase, status: "confirmed", txHash } },
      history: appendHistory(state, {
        step: action.step,
        label: stepLabel(action.step),
        status: "confirmed",
        message: action.message,
        txHash,
      }),
    };
  }

  if (action.type === "verified") {
    return {
      ...state,
      banner: action.message,
      steps: { ...state.steps, [action.step]: { ...nextStepBase, status: "verified" } },
      history: appendHistory(state, {
        step: action.step,
        label: stepLabel(action.step),
        status: "verified",
        message: action.message,
      }),
    };
  }

  return {
    ...state,
    banner: action.message,
    steps: { ...state.steps, [action.step]: { ...nextStepBase, status: "failed" } },
    history: appendHistory(state, {
      step: action.step,
      label: stepLabel(action.step),
      status: "failed",
      message: action.message,
    }),
  };
}

export function summarizeLifecycle(state: LifecycleState) {
  const completed = LIFECYCLE_STEPS.filter((step) => ["confirmed", "verified"].includes(state.steps[step.key].status)).length;
  const failed = LIFECYCLE_STEPS.filter((step) => state.steps[step.key].status === "failed").length;
  return {
    completed,
    failed,
    total: LIFECYCLE_STEPS.length,
  };
}
