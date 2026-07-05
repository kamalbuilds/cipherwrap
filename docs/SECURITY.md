# Security notes

CipherWrap is unaudited community software.

## Trust assumptions

- Zama registry validity is the canonical source for wrapper validity.
- Official wrapper contracts enforce wrap and unwrap semantics.
- The user's wallet controls EIP-712 signatures for user decryption.
- The app never stores user decryption keys. The relayer keypair is generated per decryption request in memory.

## Known limitations

- Final unwrap requires a public decryption proof for the emitted amount handle. CipherWrap stages the request id, reads the amount handle, attempts public decryption for the clear amount, and requires the proof bytes before it submits `finalizeUnwrap`.
- The app supports Sepolia only.
- The app reads docs metadata for names and faucet availability, which may lag registry state.

## Defensive UI rules

- Show registry validity.
- Disable minting, wrapping, and unwrap requests until a pair is valid and onchain-confirmed.
- Keep revoked pairs visible for auditability, but label them and block writes.
- Lock write actions during registry fallback instead of trusting local metadata.
- Mark restricted pairs as non-mintable.
- Require wallet signature before balance decryption.
