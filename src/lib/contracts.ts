export const SEPOLIA_CHAIN_ID = 11155111n;

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function mint(address to,uint256 amount)",
] as const;

export const WRAPPER_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function wrap(address to,uint256 amount)",
  "function unwrap(address from,address to,bytes32 encryptedAmount,bytes inputProof)",
  "function finalizeUnwrap(bytes32 unwrapRequestId,uint64 unwrapAmountCleartext,bytes decryptionProof)",
  "function rate() view returns (uint256)",
  "function unwrapAmount(bytes32 unwrapRequestId) view returns (bytes32)",
  "function confidentialTransfer(address to,bytes32 encryptedAmount,bytes inputProof)",
  "function setOperator(address operator,uint48 until)",
] as const;

export const REGISTRY_ABI = [
  "function getTokenConfidentialTokenPairsLength() view returns (uint256)",
  "function getTokenConfidentialTokenPair(uint256 index) view returns (tuple(address tokenAddress,address confidentialTokenAddress,bool isValid))",
  "function getTokenConfidentialTokenPairs() view returns (tuple(address tokenAddress,address confidentialTokenAddress,bool isValid)[])",
  "function isConfidentialTokenValid(address confidentialTokenAddress) view returns (bool)",
] as const;

export const WRAPPERS_REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" as const;

export type WrapperPair = {
  name: string;
  symbol: string;
  wrapper: `0x${string}`;
  underlying: `0x${string}`;
  mintable: boolean;
};

export const SEPOLIA_WRAPPER_PAIRS: WrapperPair[] = [
  { name: "Confidential USDC", symbol: "cUSDCMock", wrapper: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639", underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF", mintable: true },
  { name: "Confidential USDT", symbol: "cUSDTMock", wrapper: "0x4E7B06D78965594eB5EF5414c357ca21E1554491", underlying: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0", mintable: true },
  { name: "Confidential WETH", symbol: "cWETHMock", wrapper: "0x46208622DA27d91db4f0393733C8BA082ed83158", underlying: "0xff54739b16576FA5402F211D0b938469Ab9A5f3F", mintable: true },
  { name: "Confidential BRON", symbol: "cBRONMock", wrapper: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891", underlying: "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E", mintable: true },
  { name: "Confidential ZAMA", symbol: "cZAMAMock", wrapper: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB", underlying: "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57", mintable: true },
  { name: "Confidential tGBP", symbol: "ctGBPMock", wrapper: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC", underlying: "0x93c931278A2aad1916783F952f94276eA5111442", mintable: true },
  { name: "Confidential XAUt", symbol: "cXAUtMock", wrapper: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7", underlying: "0x24377AE4AA0C45ecEe71225007f17c5D423dd940", mintable: true },
  { name: "Confidential tGBP", symbol: "ctGBP", wrapper: "0x167DC962808B32CFFFc7e14B5018c0bE06A3A208", underlying: "0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3", mintable: false },
];
