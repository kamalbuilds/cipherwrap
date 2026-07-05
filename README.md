# CipherWrap

Wrapper Registry app for the Zama Developer Program Bounty Track.

CipherWrap surfaces official ERC-20 to ERC-7984 wrapper pairs on Sepolia, helps users mint mock tokens, wrap into confidential tokens, decrypt balances, and prepare unwrap requests.

## What judges can test

- Browse every official Sepolia wrapper pair from the onchain registry.
- See registry fallback, unconfirmed pair, and revoked pair states before any write.
- Mint public mock tokens where Zama exposes a public faucet method.
- Approve and wrap ERC-20 into ERC-7984 confidential tokens.
- Check a confidential balance handle for any ERC-7984 token address.
- Request an unwrap, parse the request id, read the clear amount, and stage `finalizeUnwrap` with a public decryption proof.
- Generate a registry-first integration snippet for the selected pair.
- Read the documented process for adding a new pair.

## Stack

- React + Vite.
- Ethers v6 for wallet writes.
- `@zama-fhe/relayer-sdk` for encryption and decryption flows.
- Official Zama Sepolia registry and wrapper addresses.

## Verify locally

```bash
npm install
npm test
npm run build
```

## Production guardrails

- Onchain registry validity is required before mint, wrap, or unwrap buttons unlock.
- Docs metadata is display-only when the registry RPC fails.
- Revoked or invalid registry pairs stay visible for auditability, but writes are disabled.
- Integration snippets always call `isConfidentialTokenValid` before wrapping.
