import { useEffect, useMemo, useState } from "react";
import { Contract, parseUnits } from "ethers";
import { WalletButton } from "../components/WalletButton";
import { ERC20_ABI, WRAPPER_ABI, type WrapperPair } from "../lib/contracts";
import { WalletState, shortAddress } from "../lib/wallet";
import { bytesToHex, createFheInstance } from "../lib/fhe";
import { docsRegistryPairs, mergeRegistryPairs, readOnchainRegistry, registryCoverage, type RegistryPair } from "../lib/registry";
import { formatRawAmount, parseDecimalAmount, planWrapAmount } from "../lib/amounts";
import { userDecryptHandle } from "../lib/decryption";
import { findUnwrapRequest, type UnwrapRequestEvent } from "../lib/unwrap";

export function CipherWrap() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [pairs, setPairs] = useState<RegistryPair[]>(docsRegistryPairs());
  const [selected, setSelected] = useState<RegistryPair>(docsRegistryPairs()[0]);
  const [amount, setAmount] = useState("100");
  const [customToken, setCustomToken] = useState("");
  const [status, setStatus] = useState("Browse official pairs, mint mock tokens, wrap, user-decrypt balances, or prepare an unwrap request.");
  const [unwrapRequest, setUnwrapRequest] = useState<UnwrapRequestEvent | null>(null);
  const coverage = useMemo(() => registryCoverage(pairs), [pairs]);
  const wrapPlan = useMemo(() => {
    try {
      return planWrapAmount(amount || "0", 6, 6);
    } catch {
      return null;
    }
  }, [amount]);

  useEffect(() => {
    if (!wallet) return;
    readOnchainRegistry(wallet.provider)
      .then((onchain) => {
        const merged = mergeRegistryPairs(docsRegistryPairs(), onchain);
        setPairs(merged);
        const nextSelected = merged.find((pair) => pair.wrapper.toLowerCase() === selected.wrapper.toLowerCase()) ?? merged[0];
        setSelected(nextSelected);
        const c = registryCoverage(merged);
        setStatus(`Loaded ${c.onchainBacked} pair(s) from the onchain registry, ${c.valid} valid.`);
      })
      .catch((err) => setStatus(err instanceof Error ? `Registry fallback active: ${err.message}` : "Registry fallback active."));
  }, [wallet]);

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
      if (!selected.isValid) throw new Error("This wrapper is revoked or not valid in the registry.");
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
      const handle = await wrapperContract(pair).balanceOf(wallet.address);
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

  return (
    <section className="page-section stack">
      <div className="split-hero">
        <div>
          <p className="label">Bounty Track</p>
          <h1>Official wrappers, one clean path.</h1>
          <p className="lede">CipherWrap turns the Zama wrapper registry into a production-style workbench: live registry scan, faucet, wrap, user decryption, unwrap requests, and pair-extension docs.</p>
        </div>
        <WalletButton onConnect={setWallet} />
      </div>

      <div className="metrics">
        <div><span className="stat-number">{coverage.total}</span><span>pairs tracked</span></div>
        <div><span className="stat-number">{coverage.valid}</span><span>valid wrappers</span></div>
        <div><span className="stat-number">{coverage.onchainBacked}</span><span>onchain backed</span></div>
      </div>

      <div className="workbench two-col">
        <div className="glass-card">
          <h2>Registry pairs</h2>
          <div className="pair-list">
            {pairs.map((pair) => (
              <button key={pair.wrapper} className={pair.wrapper === selected.wrapper ? "pair-row selected" : "pair-row"} onClick={() => setSelected(pair)}>
                <span><strong>{pair.symbol}</strong><small>{pair.name} · {pair.source} · {pair.isValid ? "valid" : "revoked"}</small></span>
                <code>{shortAddress(pair.wrapper)}</code>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h2>{selected.symbol} actions</h2>
          <p className="muted">Underlying {shortAddress(selected.underlying)}. Wrapper {shortAddress(selected.wrapper)}.</p>
          <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {wrapPlan && <p className="muted">Wrap plan: {formatRawAmount(wrapPlan.roundedRaw, 6)} public units become {wrapPlan.confidentialUnits.toString()} confidential units.</p>}
          <div className="button-row">
            <button className="button secondary" onClick={mintUnderlying} disabled={!wallet || !selected.mintable}>Mint mock</button>
            <button className="button primary" onClick={approveAndWrap} disabled={!wallet || !selected.isValid}>Approve and wrap</button>
            <button className="button secondary" onClick={() => decryptBalance()} disabled={!wallet}>User-decrypt balance</button>
            <button className="button secondary" onClick={prepareUnwrap} disabled={!wallet}>Request unwrap</button>
          </div>
          <p className="status-line">{status}</p>
          {unwrapRequest && <p className="notice">Unwrap request {shortAddress(unwrapRequest.unwrapRequestId)}. Amount handle {shortAddress(unwrapRequest.amountHandle)}.</p>}
        </div>
      </div>

      <div className="glass-card">
        <h2>Arbitrary ERC-7984 balance check</h2>
        <p className="muted">Paste any ERC-7984 address. The app requests an EIP-712 user-decryption signature before asking the relayer to decrypt your balance handle.</p>
        <div className="inline-form"><input value={customToken} onChange={(e) => setCustomToken(e.target.value)} placeholder="0x ERC-7984 token" /><button className="button secondary" disabled={!wallet || !customToken.startsWith("0x")} onClick={() => decryptBalance({ ...selected, wrapper: customToken as `0x${string}` })}>Check token</button></div>
      </div>

      <div className="glass-card">
        <h2>Add-pair process</h2>
        <ol className="steps"><li>Deploy or choose an ERC-20 token.</li><li>Deploy an ERC-7984 wrapper with valid interface support.</li><li>Ask registry governance to register the pair.</li><li>Use local metadata only as preview. Onchain registry validity wins.</li></ol>
      </div>
    </section>
  );
}
