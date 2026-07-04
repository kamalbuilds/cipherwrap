import { useMemo, useState } from "react";
import { Contract, parseUnits } from "ethers";
import { WalletButton } from "../components/WalletButton";
import { ERC20_ABI, SEPOLIA_WRAPPER_PAIRS, WRAPPER_ABI, WrapperPair } from "../lib/contracts";
import { WalletState, shortAddress } from "../lib/wallet";
import { bytesToHex, createFheInstance } from "../lib/fhe";

export function CipherWrap() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [selected, setSelected] = useState<WrapperPair>(SEPOLIA_WRAPPER_PAIRS[0]);
  const [amount, setAmount] = useState("100");
  const [customToken, setCustomToken] = useState("");
  const [status, setStatus] = useState("Browse official pairs, mint mock tokens, wrap, decrypt balances, or prepare an unwrap request.");
  const mintableCount = useMemo(() => SEPOLIA_WRAPPER_PAIRS.filter((pair) => pair.mintable).length, []);

  function underlyingContract() {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(selected.underlying, ERC20_ABI, wallet.signer);
  }

  function wrapperContract(pair = selected) {
    if (!wallet) throw new Error("Connect wallet first.");
    return new Contract(pair.wrapper, WRAPPER_ABI, wallet.signer);
  }

  async function mintUnderlying() {
    try {
      const tx = await underlyingContract().mint(wallet!.address, parseUnits(amount, 6));
      setStatus(`Minting ${amount} test tokens.`);
      await tx.wait();
      setStatus("Mock tokens minted. Approve the wrapper next.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Mint failed.");
    }
  }

  async function approveAndWrap() {
    try {
      const raw = parseUnits(amount, 6);
      const approval = await underlyingContract().approve(selected.wrapper, raw);
      setStatus("Approving wrapper spend.");
      await approval.wait();
      const tx = await wrapperContract().wrap(wallet!.address, raw);
      setStatus("Wrapping into ERC-7984 confidential tokens.");
      await tx.wait();
      setStatus("Wrapped. Decrypt your confidential balance to verify.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wrap failed.");
    }
  }

  async function decryptBalance(pair = selected) {
    if (!wallet) return;
    try {
      const handle = await wrapperContract(pair).balanceOf(wallet.address);
      const fhe = await createFheInstance(wallet.provider);
      const result = await fhe.publicDecrypt([handle]);
      setStatus(`Balance handle ${shortAddress(handle)} decrypted as ${String(result[handle] ?? "pending")}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Balance decrypt failed. Try user-decryption from your wallet if public decrypt is unavailable.");
    }
  }

  async function prepareUnwrap() {
    if (!wallet) return;
    try {
      const fhe = await createFheInstance(wallet.provider);
      const input = fhe.createEncryptedInput(selected.wrapper, wallet.address).add64(BigInt(amount) * 1_000_000n);
      const encrypted = await input.encrypt();
      const tx = await wrapperContract().unwrap(wallet.address, wallet.address, bytesToHex(encrypted.handles[0]), bytesToHex(encrypted.inputProof));
      setStatus("Unwrap requested. Finalization needs public decryption proof for the emitted amount handle.");
      await tx.wait();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unwrap request failed.");
    }
  }

  return (
    <section className="page-section stack">
      <div className="split-hero"><div><p className="label">Bounty Track</p><h1>Official wrappers, one clean path.</h1><p className="lede">CipherWrap turns the Zama wrapper registry into a usable product: discover, mint test assets, wrap, decrypt, and document new pairs.</p></div><WalletButton onConnect={setWallet} /></div>
      <div className="metrics"><div><span className="stat-number">{SEPOLIA_WRAPPER_PAIRS.length}</span><span>official pairs tracked</span></div><div><span className="stat-number">{mintableCount}</span><span>mock faucets</span></div><div><span className="stat-number">1</span><span>registry source of truth</span></div></div>
      <div className="workbench two-col">
        <div className="glass-card"><h2>Registry pairs</h2><div className="pair-list">{SEPOLIA_WRAPPER_PAIRS.map((pair) => <button key={pair.wrapper} className={pair.wrapper === selected.wrapper ? "pair-row selected" : "pair-row"} onClick={() => setSelected(pair)}><span><strong>{pair.symbol}</strong><small>{pair.name}</small></span><code>{shortAddress(pair.wrapper)}</code></button>)}</div></div>
        <div className="glass-card"><h2>{selected.symbol} actions</h2><p className="muted">Underlying {shortAddress(selected.underlying)}. Wrapper {shortAddress(selected.wrapper)}.</p><label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label><div className="button-row"><button className="button secondary" onClick={mintUnderlying} disabled={!wallet || !selected.mintable}>Mint mock</button><button className="button primary" onClick={approveAndWrap} disabled={!wallet}>Approve and wrap</button><button className="button secondary" onClick={() => decryptBalance()} disabled={!wallet}>Decrypt balance</button><button className="button secondary" onClick={prepareUnwrap} disabled={!wallet}>Request unwrap</button></div><p className="status-line">{status}</p></div>
      </div>
      <div className="glass-card"><h2>Arbitrary ERC-7984 balance check</h2><p className="muted">Paste any ERC-7984 address to inspect your confidential balance handle from the connected wallet.</p><div className="inline-form"><input value={customToken} onChange={(e) => setCustomToken(e.target.value)} placeholder="0x ERC-7984 token" /><button className="button secondary" disabled={!wallet || !customToken.startsWith("0x")} onClick={() => decryptBalance({ ...selected, wrapper: customToken as `0x${string}` })}>Check token</button></div></div>
      <div className="glass-card"><h2>Add-pair process</h2><ol className="steps"><li>Deploy or choose an ERC-20 token.</li><li>Deploy an ERC-7984 wrapper that exposes the expected wrap and unwrap surface.</li><li>Ask registry governance to register the pair and verify ERC-165 support.</li><li>Add local metadata only as a temporary preview. Onchain registry validity wins.</li></ol></div>
    </section>
  );
}
