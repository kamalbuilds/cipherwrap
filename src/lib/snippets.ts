import { REGISTRY_ABI, WRAPPER_ABI, WRAPPERS_REGISTRY, type WrapperPair } from "./contracts";

export function generateIntegrationSnippet(pair: WrapperPair) {
  return `import { Contract, parseUnits } from "ethers";

const registryAddress = "${WRAPPERS_REGISTRY}";
const underlyingAddress = "${pair.underlying}";
const wrapperAddress = "${pair.wrapper}";

const registryAbi = ${JSON.stringify(REGISTRY_ABI, null, 2)};
const wrapperAbi = ${JSON.stringify(WRAPPER_ABI, null, 2)};

export async function wrap${pair.symbol.replace(/[^a-zA-Z0-9]/g, "")}(signer, recipient, amount) {
  const registry = new Contract(registryAddress, registryAbi, signer);
  const isValid = await registry.isConfidentialTokenValid(wrapperAddress);
  if (!isValid) throw new Error("Wrapper is not valid in the Zama registry.");

  const publicToken = new Contract(underlyingAddress, [
    "function approve(address spender,uint256 amount) returns (bool)"
  ], signer);
  const wrapper = new Contract(wrapperAddress, wrapperAbi, signer);
  const rawAmount = parseUnits(amount, 6);

  const approval = await publicToken.approve(wrapperAddress, rawAmount);
  await approval.wait();

  const tx = await wrapper.wrap(recipient, rawAmount);
  return tx.wait();
}
`;
}
