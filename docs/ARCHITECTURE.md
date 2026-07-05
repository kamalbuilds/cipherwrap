# CipherWrap architecture

CipherWrap is a registry-first wrapper workbench for Zama Season 3 Bounty Track.

## Core boundary

The app does not create its own canonical token list. It merges two sources:

1. Zama's onchain `ConfidentialTokenWrappersRegistry` on Sepolia.
2. Zama docs metadata for names, symbols, and which mock underlyings expose public minting.

Onchain validity wins. Docs metadata is display-only.

## User flows

### Registry browsing

`src/lib/registry.ts` reads `getTokenConfidentialTokenPairsLength` and `getTokenConfidentialTokenPair(index)`, then merges onchain rows with docs metadata.

The same module now produces user-facing registry health and pair safety states:

- `loading`: writes are locked while the app waits for Sepolia.
- `live`: writes unlock only for onchain-confirmed valid pairs.
- `fallback`: docs metadata stays visible, but mint, wrap, and unwrap actions remain locked.
- revoked or invalid pairs: visible in the registry list, locked for writes, and labeled as revoked.

### Faucet

For official mock underlyings, CipherWrap calls `mint(address,uint256)` on the ERC-20 mock token. Restricted pairs are rendered but faucet actions are disabled.

### Wrap

The user approves the official ERC-7984 wrapper, then calls `wrap(to, amount)`. Amount rounding is shown before submission through `src/lib/amounts.ts`.

### Balance decryption

CipherWrap calls `balanceOf(address)` on the ERC-7984 token to get an encrypted handle. It then creates a Zama user-decryption EIP-712 request, asks the wallet to sign it, and calls relayer `userDecrypt`.

### Unwrap

CipherWrap encrypts a uint64 amount for the wrapper contract, calls `unwrap(from,to,encryptedAmount,inputProof)`, and parses `UnwrapRequested` from the receipt. The finalization stage requires a public decryption proof for the request amount handle.

The finalization helper keeps the request id and amount handle on screen, reads `unwrapAmount(requestId)`, attempts public decryption for the clear amount, accepts proof bytes, and calls `finalizeUnwrap(requestId, clearAmount, proof)`.

### Integration snippets

`src/lib/snippets.ts` generates a copyable Ethers example for the selected pair. The snippet checks `isConfidentialTokenValid(wrapper)` on the official registry before approval or wrapping.

## Threat model

CipherWrap is a frontend for official contracts. It must not claim a pair is safe only because it appears in local metadata. Users should trust only registry validity and official wrapper contracts.
