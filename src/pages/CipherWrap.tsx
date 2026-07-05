import { useEffect, useMemo, useReducer, useState } from "react";
import { Contract, JsonRpcProvider, isAddress, parseUnits } from "ethers";
import { WalletButton } from "../components/WalletButton";
import { ERC20_ABI, WRAPPER_ABI, WRAPPERS_REGISTRY, type WrapperPair } from "../lib/contracts";
import { WalletState, shortAddress } from "../lib/wallet";
import { bytesToHex, createFheInstance } from "../lib/fhe";
import { docsRegistryPairs, getPairSafety, mergeRegistryPairs, readOnchainRegistry, registryCoverage, summarizeRegistryState, type RegistryPair, type RegistryStatus } from "../lib/registry";
import { formatRawAmount, parseDecimalAmount, planWrapAmount } from "../lib/amounts";
import { userDecryptHandle } from "../lib/decryption";
import { buildFinalizeUnwrapArgs, findUnwrapRequest, getPublicDecryptClearAmount, type UnwrapRequestEvent } from "../lib/unwrap";
import { generateIntegrationSnippet } from "../lib/snippets";
import { LIFECYCLE_STEPS, initialLifecycleState, lifecycleReducer, summarizeLifecycle, type LifecycleStepKey } from "../lib/lifecycle";

function messageFromError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function stepClass(status: string) {
  return ["step-card", status].join(" ");
}

function statusLabel(status: string) {
  return status.replace(/([A-Z])/g, " $1").toLowerCase();
}

export function CipherWrap() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [pairs, setPairs] = useState<RegistryPair[]>(docsRegistryPairs());
  const [selected, setSelected] = useState<RegistryPair>(docsRegistryPairs()[0]);
  const [registryStatus, setRegistryStatus] = useState<RegistryStatus>("loading");
  const [amount, setAmount] = useState("100");
  const [customToken, setCustomToken] = useState("");
  const [unwrapRequest, setUnwrapRequest] = useState<UnwrapRequestEvent | null>(null);
  const [clearUnwrapAmount, setClearUnwrapAmount] = useState("");
  const [decryptionProof, setDecryptionProof] = useState("");
  const [lifecycle, dispatchLifecycle] = useReducer(lifecycleReducer, undefined, () => initialLifecycleState());
  const coverage = useMemo(() => registryCoverage(pairs), [pairs]);
  const registrySummary = useMemo(() => summarizeRegistryState(pairs, registryStatus), [pairs, registryStatus]);
  const selectedSafety = useMemo(() => getPairSafety(selected, registryStatus), [selected, registryStatus]);
  const integrationSnippet = useMemo(() => generateIntegrationSnippet(selected), [selected]);
  const lifecycleSummary = useMemo(() => summarizeLifecycle(lifecycle), [lifecycle]);
  const wrapPlan = useMemo(() => {
    try {
      return planWrapAmount(amount || "0", 6, 6);
    } catch {
      return null;
    }
  }, [amount]);

  useEffect(() => {
    const rpc = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
    readOnchainRegistry(new JsonRpcProvider(rpc))
      .then((onchain) => {
        const merged = mergeRegistryPairs(docsRegistryPairs(), onchain);
        setPairs(merged);
        const nextSelected = merged.find((pair) => pair.wrapper.toLowerCase() === selected.wrapper.toLowerCase()) ?? merged[0];
        setSelected(nextSelected);
        setRegistryStatus("live");
        const c = registryCoverage(merged);
        dispatchLifecycle({ type: "note", label: "Registry", message: `Loaded ${c.onchainBacked} pair(s) from the onchain registry, ${c.valid} valid.` });
      })
      .catch((err) => {
        const message = messageFromError(err, "Registry read failed.");
        setRegistryStatus({ kind: "fallback", error: message });
        dispatchLifecycle({ type: "note", label: "Registry", message: `Registry fallback active: ${message}` });
      });
  }, []);

  function handleWalletConnect(nextWallet: WalletState) {
    setWallet(nextWallet);
    dispatchLifecycle({ type: "note", label: "Wallet", message: `Connected ${shortAddress(nextWallet.address)} on Sepolia.` });
  }

  function selectPair(pair: RegistryPair) {
    setSelected(pair);
    setUnwrapRequest(null);
    setClearUnwrapAmount("");
    setDecryptionProof("");
    dispatchLifecycle({ type: "resetActive", message: `Selected ${pair.symbol}. Transaction history is preserved below.` });
  }

  function underlyingContract() {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(selected.underlying, ERC20_ABI, wallet.signer);
  }

  function wrapperContract(pair: WrapperPair = selected) {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(pair.wrapper, WRAPPER_ABI, wallet.signer);
  }

  async function runTransactionStep(step: LifecycleStepKey, messages: { start: string; submitted: string; confirmed: string; failed: string }, send: () => Promise<{ hash: string; wait: () => Promise<unknown> }>) {
    try {
      dispatchLifecycle({ type: "start", step, message: messages.start });
      const tx = await send();
      dispatchLifecycle({ type: "txSubmitted", step, txHash: String(tx.hash), message: messages.submitted });
      await tx.wait();
      dispatchLifecycle({ type: "txConfirmed", step, txHash: String(tx.hash), message: messages.confirmed });
      return true;
    } catch (err) {
      dispatchLifecycle({ type: "failed", step, message: messageFromError(err, messages.failed) });
      return false;
    }
  }

  async function mintUnderlying() {
    if (!selectedSafety.canMint) {
      dispatchLifecycle({ type: "failed", step: "mint", message: selectedSafety.reason });
      return;
    }
    await runTransactionStep("mint", {
      start: `Confirm mint of ${amount} public ${selected.symbol.replace(/^c/, "")} test tokens in your wallet.`,
      submitted: "Mint transaction submitted. Open the Etherscan link for live confirmation.",
      confirmed: "Mock tokens minted. Approve the wrapper spend next.",
      failed: "Mint failed.",
    }, async () => underlyingContract().mint(wallet!.address, parseUnits(amount, 6)) as Promise<{ hash: string; wait: () => Promise<unknown> }>);
  }

  async function approveUnderlying() {
    if (!selectedSafety.canWrite) {
      dispatchLifecycle({ type: "failed", step: "approve", message: selectedSafety.reason });
      return;
    }
    await runTransactionStep("approve", {
      start: `Confirm approval for ${amount} public units to the wrapper.`,
      submitted: "Approval submitted. The next action stays locked in your wallet until this confirms.",
      confirmed: "Approval confirmed. Wrap the approved amount when ready.",
      failed: "Approval failed.",
    }, async () => {
      const raw = parseDecimalAmount(amount, 6);
      return underlyingContract().approve(selected.wrapper, raw) as Promise<{ hash: string; wait: () => Promise<unknown> }>;
    });
  }

  async function wrapApproved() {
    if (!selectedSafety.canWrite) {
      dispatchLifecycle({ type: "failed", step: "wrap", message: selectedSafety.reason });
      return;
    }
    await runTransactionStep("wrap", {
      start: `Confirm wrap of ${amount} public units into ${selected.symbol}.`,
      submitted: "Wrap submitted. The transaction history now has the Etherscan link.",
      confirmed: "Wrapped into confidential ERC-7984 tokens. Use user decryption to verify your private balance.",
      failed: "Wrap failed.",
    }, async () => {
      const raw = parseDecimalAmount(amount, 6);
      return wrapperContract().wrap(wallet!.address, raw) as Promise<{ hash: string; wait: () => Promise<unknown> }>;
    });
  }

  async function decryptBalance(pair = selected) {
    if (!wallet) {
      dispatchLifecycle({ type: "failed", step: "userDecrypt", message: "Connect wallet first." });
      return;
    }
    try {
      dispatchLifecycle({ type: "start", step: "userDecrypt", message: `Reading encrypted balance handle for ${pair.symbol}.` });
      const handle = await wrapperContract(pair).confidentialBalanceOf(wallet.address);
      dispatchLifecycle({ type: "start", step: "userDecrypt", message: "Requesting EIP-712 signature for user decryption." });
      const result = await userDecryptHandle(wallet.provider, {
        handle,
        contractAddress: pair.wrapper,
        userAddress: wallet.address as `0x${string}`,
      });
      dispatchLifecycle({ type: "verified", step: "userDecrypt", message: `User-decrypted ${pair.symbol} balance: ${String(result[handle] ?? "available in relayer result")}.` });
    } catch (err) {
      dispatchLifecycle({ type: "failed", step: "userDecrypt", message: messageFromError(err, "User decryption failed.") });
    }
  }

  async function prepareUnwrap() {
    if (!wallet) {
      dispatchLifecycle({ type: "failed", step: "unwrapRequest", message: "Connect wallet first." });
      return;
    }
    if (!selectedSafety.canWrite) {
      dispatchLifecycle({ type: "failed", step: "unwrapRequest", message: selectedSafety.reason });
      return;
    }
    try {
      dispatchLifecycle({ type: "start", step: "unwrapRequest", message: `Encrypting unwrap amount ${amount} for ${selected.symbol}.` });
      const raw = parseDecimalAmount(amount, 6);
      const fhe = await createFheInstance(wallet.provider);
      const input = fhe.createEncryptedInput(selected.wrapper, wallet.address).add64(raw);
      const encrypted = await input.encrypt();
      const tx = await wrapperContract().unwrap(wallet.address, wallet.address, bytesToHex(encrypted.handles[0]), bytesToHex(encrypted.inputProof));
      dispatchLifecycle({ type: "txSubmitted", step: "unwrapRequest", txHash: String(tx.hash), message: "Unwrap request submitted. Waiting for receipt logs." });
      const receipt = await tx.wait();
      const request = receipt ? findUnwrapRequest(receipt) : null;
      setUnwrapRequest(request);
      dispatchLifecycle({
        type: "txConfirmed",
        step: "unwrapRequest",
        txHash: String(tx.hash),
        message: request ? `Unwrap request ${shortAddress(request.unwrapRequestId)} created. Finalize after the public decrypt proof is available.` : "Unwrap request confirmed, but the request event was not parsed from the receipt.",
      });
    } catch (err) {
      dispatchLifecycle({ type: "failed", step: "unwrapRequest", message: messageFromError(err, "Unwrap request failed.") });
    }
  }

  async function readUnwrapClearAmount() {
    if (!wallet || !unwrapRequest) return;
    try {
      dispatchLifecycle({ type: "note", label: "Public decrypt", message: `Reading unwrap amount handle ${shortAddress(unwrapRequest.amountHandle)}.` });
      const handle = await wrapperContract().unwrapAmount(unwrapRequest.unwrapRequestId);
      const fhe = await createFheInstance(wallet.provider);
      const result = await fhe.publicDecrypt([handle]);
      const clearAmount = getPublicDecryptClearAmount(result, handle);
      setClearUnwrapAmount(clearAmount.toString());
      dispatchLifecycle({ type: "note", label: "Public decrypt", message: `Public decrypt returned unwrap amount ${clearAmount.toString()}. Paste the proof before finalizing.` });
    } catch (err) {
      dispatchLifecycle({ type: "note", label: "Public decrypt", message: messageFromError(err, "Could not read clear unwrap amount.") });
    }
  }

  async function finalizeUnwrap() {
    if (!wallet || !unwrapRequest) {
      dispatchLifecycle({ type: "failed", step: "finalizeUnwrap", message: "Create an unwrap request first." });
      return;
    }
    if (!selectedSafety.canWrite) {
      dispatchLifecycle({ type: "failed", step: "finalizeUnwrap", message: selectedSafety.reason });
      return;
    }
    try {
      const [requestId, clearAmount, proof] = buildFinalizeUnwrapArgs({
        unwrapRequestId: unwrapRequest.unwrapRequestId,
        clearAmount: clearUnwrapAmount,
        decryptionProof,
      });
      dispatchLifecycle({ type: "start", step: "finalizeUnwrap", message: `Confirm finalization for request ${shortAddress(requestId)}.` });
      const tx = await wrapperContract().finalizeUnwrap(requestId, clearAmount, proof);
      dispatchLifecycle({ type: "txSubmitted", step: "finalizeUnwrap", txHash: String(tx.hash), message: "Finalize unwrap submitted. Waiting for Sepolia confirmation." });
      await tx.wait();
      dispatchLifecycle({ type: "txConfirmed", step: "finalizeUnwrap", txHash: String(tx.hash), message: "Unwrap finalized. Check the underlying ERC-20 balance for public tokens." });
    } catch (err) {
      dispatchLifecycle({ type: "failed", step: "finalizeUnwrap", message: messageFromError(err, "Finalize unwrap failed.") });
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(integrationSnippet);
      dispatchLifecycle({ type: "note", label: "Snippet", message: "Integration snippet copied." });
    } catch (err) {
      dispatchLifecycle({ type: "note", label: "Snippet", message: messageFromError(err, "Could not copy integration snippet.") });
    }
  }

  return (
    <section className="page-section stack">
      <div className="split-hero">
        <div>
          <p className="label">Bounty Track</p>
          <h1><span>Official wrappers.</span><span>One clean path.</span></h1>
          <p className="lede">CipherWrap turns the Zama wrapper registry into a production-style workbench: live registry scan, faucet, approvals, wrapping, user decryption, unwrap requests, and developer handoff code.</p>
        </div>
        <div className="hero-side">
          <WalletButton onConnect={handleWalletConnect} />
          <div className="metrics hero-metrics">
            <div><span className="stat-number">{coverage.total}</span><span>pairs</span></div>
            <div><span className="stat-number">{coverage.valid}</span><span>valid</span></div>
            <div><span className="stat-number">{coverage.onchainBacked}</span><span>onchain</span></div>
          </div>
        </div>
      </div>

      <div className={`registry-alert ${registrySummary.tone}`}>
        <div>
          <strong>{registrySummary.title}</strong>
          <p>{registrySummary.detail}</p>
        </div>
        <span className="registry-count">{registrySummary.invalidCount} invalid</span>
      </div>

      <div className="workbench two-col">
        <div className="glass-card">
          <h2>Registry pairs</h2>
          <div className="pair-list">
            {pairs.map((pair) => {
              const safety = getPairSafety(pair, registryStatus);
              const className = ["pair-row", pair.wrapper === selected.wrapper ? "selected" : "", safety.tone === "danger" ? "invalid" : ""].filter(Boolean).join(" ");
              return (
                <button key={pair.wrapper} className={className} onClick={() => selectPair(pair)}>
                  <span><strong>{pair.symbol}</strong><small>{pair.name} · {pair.source} · {safety.badge}</small></span>
                  <code>{shortAddress(pair.wrapper)}</code>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card action-card">
          <div className="card-title-row">
            <div>
              <h2>{selected.symbol} lifecycle</h2>
              <p className="muted compact">Underlying {shortAddress(selected.underlying)}. Wrapper {shortAddress(selected.wrapper)}.</p>
            </div>
            <span className="registry-count">{lifecycleSummary.completed}/{lifecycleSummary.total} steps done</span>
          </div>
          <div className={`pair-state ${selectedSafety.tone}`}>
            <strong>{selectedSafety.badge}</strong>
            <span>{selectedSafety.reason}</span>
          </div>
          <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {wrapPlan && <p className="muted compact">Wrap plan: {formatRawAmount(wrapPlan.roundedRaw, 6)} public units become {wrapPlan.confidentialUnits.toString()} raw confidential units.</p>}
          <div className="button-row action-row">
            <button className="button secondary" onClick={mintUnderlying} disabled={!wallet || !selectedSafety.canMint}>Mint mock</button>
            <button className="button secondary" onClick={approveUnderlying} disabled={!wallet || !selectedSafety.canWrite}>Approve spend</button>
            <button className="button primary" onClick={wrapApproved} disabled={!wallet || !selectedSafety.canWrite}>Wrap approved</button>
            <button className="button secondary" onClick={() => decryptBalance()} disabled={!wallet}>User-decrypt balance</button>
            <button className="button secondary" onClick={prepareUnwrap} disabled={!wallet || !selectedSafety.canWrite}>Request unwrap</button>
          </div>
          <p className="status-line">{lifecycle.banner}</p>
          <div className="lifecycle-grid">
            {LIFECYCLE_STEPS.map((step) => {
              const state = lifecycle.steps[step.key];
              return (
                <div key={step.key} className={stepClass(state.status)}>
                  <span className="step-label">{step.label}</span>
                  <span className="step-status">{statusLabel(state.status)}</span>
                  {state.txHash && <a href={`https://sepolia.etherscan.io/tx/${state.txHash}`} target="_blank" rel="noreferrer">Etherscan</a>}
                </div>
              );
            })}
          </div>
          {unwrapRequest && <p className="notice">Unwrap request {shortAddress(unwrapRequest.unwrapRequestId)}. Amount handle {shortAddress(unwrapRequest.amountHandle)}.</p>}
          <div className="helper-panel">
            <h3>Unwrap finalization helper</h3>
            <p className="muted">Finalization needs a public decrypt clear amount and proof. The helper keeps the request id from the latest unwrap receipt so you only paste the proof bytes.</p>
            {unwrapRequest ? (
              <>
                <div className="button-row">
                  <button className="button secondary" onClick={readUnwrapClearAmount} disabled={!wallet}>Read clear amount</button>
                </div>
                <label>Clear amount<input value={clearUnwrapAmount} onChange={(e) => setClearUnwrapAmount(e.target.value)} placeholder="Public decrypt amount" /></label>
                <label>Public decryption proof<input value={decryptionProof} onChange={(e) => setDecryptionProof(e.target.value)} placeholder="0x proof bytes" /></label>
                <button className="button primary" onClick={finalizeUnwrap} disabled={!wallet || !clearUnwrapAmount || !decryptionProof}>Finalize unwrap</button>
              </>
            ) : (
              <p className="muted">Request an unwrap to stage the request id and amount handle here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="workbench two-col">
        <div className="glass-card">
          <div className="card-title-row">
            <h2>Transaction and proof history</h2>
            <span className="registry-count">latest 12</span>
          </div>
          <div className="history-list">
            {lifecycle.history.length ? lifecycle.history.map((entry) => (
              <div key={entry.id} className={`history-row ${entry.status}`}>
                <div>
                  <strong>{entry.label}</strong>
                  <p>{entry.message}</p>
                </div>
                <div className="history-meta">
                  <span>{entry.status}</span>
                  {entry.href && <a href={entry.href} target="_blank" rel="noreferrer">Etherscan</a>}
                </div>
              </div>
            )) : (
              <p className="muted">Your first wallet confirmation, registry check, or user-decrypt proof will appear here with a durable status.</p>
            )}
          </div>
        </div>

        <div className="glass-card">
          <h2>Arbitrary ERC-7984 balance check</h2>
          <p className="muted">Paste any ERC-7984 address. The app requests an EIP-712 user-decryption signature before asking the relayer to decrypt your balance handle.</p>
          <div className="inline-form"><input value={customToken} onChange={(e) => setCustomToken(e.target.value)} placeholder="0x ERC-7984 token" /><button className="button secondary" disabled={!wallet || !isAddress(customToken)} onClick={() => decryptBalance({ ...selected, wrapper: customToken as `0x${string}` })}>Check token</button></div>
          <div className="developer-facts">
            <span>Registry <code>{shortAddress(WRAPPERS_REGISTRY)}</code></span>
            <span>Selected wrapper <code>{shortAddress(selected.wrapper)}</code></span>
            <span>Selected public token <code>{shortAddress(selected.underlying)}</code></span>
          </div>
        </div>
      </div>

      <div className="glass-card developer-panel">
        <div className="card-title-row">
          <div>
            <h2>Integration snippet</h2>
            <p className="muted compact">Registry validation, approval, wrapping, balance-handle reads, unwrap requests, and finalize helpers for the selected pair.</p>
          </div>
          <button className="button secondary" onClick={copySnippet}>Copy snippet</button>
        </div>
        <div className="snippet-layout">
          <div className="snippet-notes">
            <h3>Developer checklist</h3>
            <ol className="steps">
              <li>Check `isConfidentialTokenValid` before every write.</li>
              <li>Approve the public ERC-20, then call `wrap` with the same raw amount.</li>
              <li>Read `confidentialBalanceOf` and run user decryption in the client.</li>
              <li>Keep unwrap finalization gated on a public decrypt proof.</li>
            </ol>
          </div>
          <textarea className="code-box" readOnly value={integrationSnippet} />
        </div>
      </div>

      <div className="glass-card">
        <h2>Add-pair process</h2>
        <ol className="steps"><li>Deploy or choose an ERC-20 token.</li><li>Deploy an ERC-7984 wrapper with valid interface support.</li><li>Ask registry governance to register the pair.</li><li>Use local metadata only as preview. Onchain registry validity wins.</li></ol>
      </div>
    </section>
  );
}
