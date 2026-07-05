import { useEffect, useMemo, useState } from "react";
import { Contract, JsonRpcProvider, isAddress, parseUnits } from "ethers";
import { WalletButton } from "../components/WalletButton";
import { ERC20_ABI, WRAPPER_ABI, type WrapperPair } from "../lib/contracts";
import { WalletState, shortAddress } from "../lib/wallet";
import { bytesToHex, createFheInstance } from "../lib/fhe";
import { docsRegistryPairs, getPairSafety, mergeRegistryPairs, readOnchainRegistry, registryCoverage, summarizeRegistryState, type RegistryPair, type RegistryStatus } from "../lib/registry";
import { formatRawAmount, parseDecimalAmount, planWrapAmount } from "../lib/amounts";
import { userDecryptHandle } from "../lib/decryption";
import { buildFinalizeUnwrapArgs, findUnwrapRequest, getPublicDecryptClearAmount, type UnwrapRequestEvent } from "../lib/unwrap";
import { generateIntegrationSnippet } from "../lib/snippets";

export function CipherWrap() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [pairs, setPairs] = useState<RegistryPair[]>(docsRegistryPairs());
  const [selected, setSelected] = useState<RegistryPair>(docsRegistryPairs()[0]);
  const [registryStatus, setRegistryStatus] = useState<RegistryStatus>("loading");
  const [amount, setAmount] = useState("100");
  const [customToken, setCustomToken] = useState("");
  const [status, setStatus] = useState("Browse official pairs, mint mock tokens, wrap, user-decrypt balances, or prepare an unwrap request.");
  const [unwrapRequest, setUnwrapRequest] = useState<UnwrapRequestEvent | null>(null);
  const [clearUnwrapAmount, setClearUnwrapAmount] = useState("");
  const [decryptionProof, setDecryptionProof] = useState("");
  const coverage = useMemo(() => registryCoverage(pairs), [pairs]);
  const registrySummary = useMemo(() => summarizeRegistryState(pairs, registryStatus), [pairs, registryStatus]);
  const selectedSafety = useMemo(() => getPairSafety(selected, registryStatus), [selected, registryStatus]);
  const integrationSnippet = useMemo(() => generateIntegrationSnippet(selected), [selected]);
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
        setStatus(`Loaded ${c.onchainBacked} pair(s) from the onchain registry, ${c.valid} valid.`);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Registry read failed.";
        setRegistryStatus({ kind: "fallback", error: message });
        setStatus(`Registry fallback active: ${message}`);
      });
  }, []);

  function selectPair(pair: RegistryPair) {
    setSelected(pair);
    setUnwrapRequest(null);
    setClearUnwrapAmount("");
    setDecryptionProof("");
  }

  function underlyingContract() {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(selected.underlying, ERC20_ABI, wallet.signer);
  }

  function wrapperContract(pair: WrapperPair = selected) {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(pair.wrapper, WRAPPER_ABI, wallet.signer);
  }

  async function mintUnderlying() {
    try {
      if (!selectedSafety.canMint) throw new Error(selectedSafety.reason);
      const tx = await underlyingContract().mint(wallet!.address, parseUnits(amount, 6));
      setStatus(`Minting ${amount} public test tokens.`);
      await tx.wait();
      setStatus("Mock tokens minted. Approve the wrapper next.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Mint failed.");
    }
  }

  async function approveAndWrap() {
    try {
      if (!selectedSafety.canWrite) throw new Error(selectedSafety.reason);
      const raw = parseDecimalAmount(amount, 6);
      const approval = await underlyingContract().approve(selected.wrapper, raw);
      setStatus("Approving wrapper spend.");
      await approval.wait();
      const tx = await wrapperContract().wrap(wallet!.address, raw);
      setStatus("Wrapping into ERC-7984 confidential tokens.");
      await tx.wait();
      setStatus("Wrapped. Use user decryption to verify your confidential balance.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wrap failed.");
    }
  }

  async function decryptBalance(pair = selected) {
    if (!wallet) return;
    try {
      const handle = await wrapperContract(pair).confidentialBalanceOf(wallet.address);
      setStatus("Requesting EIP-712 signature for user decryption.");
      const result = await userDecryptHandle(wallet.provider, {
        handle,
        contractAddress: pair.wrapper,
        userAddress: wallet.address as `0x${string}`,
      });
      setStatus(`User-decrypted ${pair.symbol} balance: ${String(result[handle] ?? "available in result")}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "User decryption failed.");
    }
  }

  async function prepareUnwrap() {
    if (!wallet) return;
    try {
      if (!selectedSafety.canWrite) throw new Error(selectedSafety.reason);
      const raw = parseDecimalAmount(amount, 6);
      const fhe = await createFheInstance(wallet.provider);
      const input = fhe.createEncryptedInput(selected.wrapper, wallet.address).add64(raw);
      const encrypted = await input.encrypt();
      const tx = await wrapperContract().unwrap(wallet.address, wallet.address, bytesToHex(encrypted.handles[0]), bytesToHex(encrypted.inputProof));
      setStatus("Unwrap requested. Reading request id and amount handle from receipt.");
      const receipt = await tx.wait();
      const request = receipt ? findUnwrapRequest(receipt) : null;
      setUnwrapRequest(request);
      setStatus(request ? `Unwrap request ${shortAddress(request.unwrapRequestId)} created. Finalize after public decryption proof is available.` : "Unwrap requested. Could not parse request event from receipt.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unwrap request failed.");
    }
  }

  async function readUnwrapClearAmount() {
    if (!wallet || !unwrapRequest) return;
    try {
      const handle = await wrapperContract().unwrapAmount(unwrapRequest.unwrapRequestId);
      const fhe = await createFheInstance(wallet.provider);
      const result = await fhe.publicDecrypt([handle]);
      const clearAmount = getPublicDecryptClearAmount(result, handle);
      setClearUnwrapAmount(clearAmount.toString());
      setStatus(`Public decrypt returned unwrap amount ${clearAmount.toString()}. Paste the public decryption proof before finalizing.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not read clear unwrap amount.");
    }
  }

  async function finalizeUnwrap() {
    if (!wallet || !unwrapRequest) return;
    try {
      if (!selectedSafety.canWrite) throw new Error(selectedSafety.reason);
      const [requestId, clearAmount, proof] = buildFinalizeUnwrapArgs({
        unwrapRequestId: unwrapRequest.unwrapRequestId,
        clearAmount: clearUnwrapAmount,
        decryptionProof,
      });
      const tx = await wrapperContract().finalizeUnwrap(requestId, clearAmount, proof);
      setStatus(`Finalizing unwrap request ${shortAddress(requestId)}.`);
      await tx.wait();
      setStatus("Unwrap finalized. Public tokens can be checked in the underlying ERC-20 balance.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Finalize unwrap failed.");
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(integrationSnippet);
      setStatus("Integration snippet copied.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not copy integration snippet.");
    }
  }

  return (
    <section className="page-section stack">
      <div className="split-hero">
        <div>
          <p className="label">Bounty Track</p>
          <h1><span>Official wrappers.</span><span>One clean path.</span></h1>
          <p className="lede">CipherWrap turns the Zama wrapper registry into a production-style workbench: live registry scan, faucet, wrap, user decryption, unwrap requests, and pair-extension docs.</p>
        </div>
        <WalletButton onConnect={setWallet} />
      </div>

      <div className="metrics">
        <div><span className="stat-number">{coverage.total}</span><span>pairs tracked</span></div>
        <div><span className="stat-number">{coverage.valid}</span><span>valid wrappers</span></div>
        <div><span className="stat-number">{coverage.onchainBacked}</span><span>onchain backed</span></div>
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

        <div className="glass-card">
          <h2>{selected.symbol} actions</h2>
          <p className="muted">Underlying {shortAddress(selected.underlying)}. Wrapper {shortAddress(selected.wrapper)}.</p>
          <div className={`pair-state ${selectedSafety.tone}`}>
            <strong>{selectedSafety.badge}</strong>
            <span>{selectedSafety.reason}</span>
          </div>
          <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {wrapPlan && <p className="muted">Wrap plan: {formatRawAmount(wrapPlan.roundedRaw, 6)} public units become {wrapPlan.confidentialUnits.toString()} raw confidential units.</p>}
          <div className="button-row">
            <button className="button secondary" onClick={mintUnderlying} disabled={!wallet || !selectedSafety.canMint}>Mint mock</button>
            <button className="button primary" onClick={approveAndWrap} disabled={!wallet || !selectedSafety.canWrite}>Approve and wrap</button>
            <button className="button secondary" onClick={() => decryptBalance()} disabled={!wallet}>User-decrypt balance</button>
            <button className="button secondary" onClick={prepareUnwrap} disabled={!wallet || !selectedSafety.canWrite}>Request unwrap</button>
          </div>
          <p className="status-line">{status}</p>
          {unwrapRequest && <p className="notice">Unwrap request {shortAddress(unwrapRequest.unwrapRequestId)}. Amount handle {shortAddress(unwrapRequest.amountHandle)}.</p>}
          <div className="helper-panel">
            <h3>Unwrap finalization helper</h3>
            <p className="muted">After the public decrypt flow emits a proof, use this helper to submit `finalizeUnwrap` without retyping the request id.</p>
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

      <div className="glass-card">
        <h2>Arbitrary ERC-7984 balance check</h2>
        <p className="muted">Paste any ERC-7984 address. The app requests an EIP-712 user-decryption signature before asking the relayer to decrypt your balance handle.</p>
        <div className="inline-form"><input value={customToken} onChange={(e) => setCustomToken(e.target.value)} placeholder="0x ERC-7984 token" /><button className="button secondary" disabled={!wallet || !isAddress(customToken)} onClick={() => decryptBalance({ ...selected, wrapper: customToken as `0x${string}` })}>Check token</button></div>
      </div>

      <div className="glass-card">
        <div className="card-title-row">
          <h2>Integration snippet</h2>
          <button className="button secondary" onClick={copySnippet}>Copy snippet</button>
        </div>
        <p className="muted">Generate a registry-first example for the selected pair. Teams can paste it into their app and keep the validity check before writes.</p>
        <textarea className="code-box" readOnly value={integrationSnippet} />
      </div>

      <div className="glass-card">
        <h2>Add-pair process</h2>
        <ol className="steps"><li>Deploy or choose an ERC-20 token.</li><li>Deploy an ERC-7984 wrapper with valid interface support.</li><li>Ask registry governance to register the pair.</li><li>Use local metadata only as preview. Onchain registry validity wins.</li></ol>
      </div>
    </section>
  );
}
