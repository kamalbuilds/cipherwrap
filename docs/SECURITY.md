# Security notes

CipherWrap is unaudited community software.

## Trust assumptions

- Zama registry validity is the canonical source for wrapper validity.
- Official wrapper contracts enforce wrap and unwrap semantics.
- The user's wallet controls EIP-712 signatures for user decryption.
- The app never stores user decryption keys. The relayer keypair is generated per decryption request in memory.

## Known limitations

- Final unwrap requires a public decryption proof for the emitted amount handle. CipherWrap currently parses and surfaces the request id and handle, but finalization UX is a follow-up feature.
- The app supports Sepolia only.
- The app reads docs metadata for names and faucet availability, which may lag registry state.

## Defensive UI rules

- Show registry validity.
- Disable wrapping invalid pairs.
- Mark restricted pairs as non-mintable.
- Require wallet signature before balance decryption.
