import { useState } from "react";
import { WalletState, connectWallet, shortAddress } from "../lib/wallet";

export function WalletButton({ onConnect }: { onConnect: (wallet: WalletState) => void }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  async function connect() {
    setError("");
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      onConnect(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    }
  }

  return (
    <div className="wallet-box">
      <button className="button primary" onClick={connect}>{address ? shortAddress(address) : "Connect Sepolia wallet"}</button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
