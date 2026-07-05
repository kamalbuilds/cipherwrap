import { BrowserProvider, JsonRpcSigner } from "ethers";
import { SEPOLIA_CHAIN_ID } from "./contracts";

declare global {
  interface Window {
    ethereum?: {
      isRabby?: boolean;
      providers?: Array<{ isRabby?: boolean; request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }>;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    rabby?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export type WalletState = {
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
};

function getWalletProvider() {
  const eth = window.ethereum;
  const rabbyFromProviders = eth?.providers?.find((provider) => provider.isRabby);
  return window.rabby ?? rabbyFromProviders ?? eth;
}

async function ensureSepolia(walletProvider: NonNullable<ReturnType<typeof getWalletProvider>>) {
  const chainId = await walletProvider.request({ method: "eth_chainId" });
  if (chainId === "0xaa36a7") return;
  try {
    await walletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: number }).code : undefined;
    if (code !== 4902) throw err;
    await walletProvider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0xaa36a7",
        chainName: "Sepolia",
        nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"],
      }],
    });
  }
}

export async function connectWallet(): Promise<WalletState> {
  const walletProvider = getWalletProvider();
  if (!walletProvider) throw new Error("Install Rabby or another EIP-1193 wallet to use Sepolia actions.");
  const accounts = (await walletProvider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("Wallet returned no accounts.");
  await ensureSepolia(walletProvider);
  const provider = new BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
