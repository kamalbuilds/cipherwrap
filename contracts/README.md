# Smart contract surface

CipherWrap uses the official Zama Sepolia registry and wrapper contracts instead of deploying a custom registry.

Included smart contract surfaces:

- `ConfidentialTokenWrappersRegistry`: discovers ERC-20 to ERC-7984 pairs.
- `ConfidentialWrapper`: wraps ERC-20 into ERC-7984 confidential tokens.
- ERC-20 mock tokens: mintable Sepolia test assets for the faucet path.

The frontend ABI definitions live in `src/lib/contracts.ts` and point to official Sepolia addresses from Zama docs.
