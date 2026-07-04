# CipherWrap

Wrapper Registry app for the Zama Developer Program Bounty Track.

CipherWrap surfaces official ERC-20 to ERC-7984 wrapper pairs on Sepolia, helps users mint mock tokens, wrap into confidential tokens, decrypt balances, and prepare unwrap requests.

## What judges can test

- Browse every official Sepolia wrapper pair.
- Mint public mock tokens where Zama exposes a public faucet method.
- Approve and wrap ERC-20 into ERC-7984 confidential tokens.
- Check a confidential balance handle for any ERC-7984 token address.
- Read the documented process for adding a new pair.

## Stack

- React + Vite.
- Ethers v6 for wallet writes.
- `@zama-fhe/relayer-sdk` for encryption and decryption flows.
- Official Zama Sepolia registry and wrapper addresses.

## Verify locally

```bash
npm install
npm run build
```
