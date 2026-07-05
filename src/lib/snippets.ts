import { REGISTRY_ABI, WRAPPER_ABI, WRAPPERS_REGISTRY, type WrapperPair } from "./contracts";

function safeFunctionSuffix(symbol: string) {
  const suffix = symbol.replace(/[^a-zA-Z0-9]/g, "");
  return suffix || "Token";
}

export function generateIntegrationSnippet(pair: WrapperPair) {
  const suffix = safeFunctionSuffix(pair.symbol);
  return `import { BrowserProvider, Contract, parseUnits } from "ethers";

const registryAddress = "${WRAPPERS_REGISTRY}";
const underlyingAddress = "${pair.underlying}";
const wrapperAddress = "${pair.wrapper}";
const decimals = 6;

const registryAbi = ${JSON.stringify(REGISTRY_ABI, null, 2)};
const wrapperAbi = ${JSON.stringify(WRAPPER_ABI, null, 2)};
const erc20Abi = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

export async function assert${suffix}RegistryPair(signerOrProvider) {
  const registry = new Contract(registryAddress, registryAbi, signerOrProvider);
  const isValid = await registry.isConfidentialTokenValid(wrapperAddress);
  if (!isValid) throw new Error("Wrapper is not valid in the Zama registry.");
  return { registryAddress, underlyingAddress, wrapperAddress };
}

export async function approveAndWrap${suffix}(signer, recipient, amount) {
  await assert${suffix}RegistryPair(signer);
  const rawAmount = parseUnits(amount, decimals);
  const publicToken = new Contract(underlyingAddress, erc20Abi, signer);
  const wrapper = new Contract(wrapperAddress, wrapperAbi, signer);

  const approval = await publicToken.approve(wrapperAddress, rawAmount);
  await approval.wait();

  const wrapTx = await wrapper.wrap(recipient, rawAmount);
  return wrapTx.wait();
}

export async function read${suffix}BalanceHandle(signer, account) {
  await assert${suffix}RegistryPair(signer);
  const wrapper = new Contract(wrapperAddress, wrapperAbi, signer);
  return wrapper.confidentialBalanceOf(account);
}

export async function request${suffix}Unwrap({ signer, from, to, encryptedAmount, inputProof }) {
  await assert${suffix}RegistryPair(signer);
  const wrapper = new Contract(wrapperAddress, wrapperAbi, signer);
  const tx = await wrapper.unwrap(from, to, encryptedAmount, inputProof);
  return tx.wait();
}

export async function finalize${suffix}Unwrap({ signer, unwrapRequestId, clearAmount, publicDecryptProof }) {
  await assert${suffix}RegistryPair(signer);
  const wrapper = new Contract(wrapperAddress, wrapperAbi, signer);
  const tx = await wrapper.finalizeUnwrap(unwrapRequestId, BigInt(clearAmount), publicDecryptProof);
  return tx.wait();
}

export async function providerFromInjectedWallet(injectedProvider) {
  const provider = new BrowserProvider(injectedProvider);
  const signer = await provider.getSigner();
  return { provider, signer, account: await signer.getAddress() };
}
`;
}
