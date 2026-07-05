# Adding wrapper pairs

CipherWrap treats the onchain registry as source of truth.

1. Deploy or choose an ERC-20 token.
2. Deploy a valid ERC-7984 wrapper for that token.
3. Confirm the wrapper supports ERC-7984 interface detection.
4. Ask registry governance to register the pair.
5. Add temporary local metadata only for preview builds.
6. Remove preview metadata once the registry returns the pair as valid.

Validity is checked onchain before users wrap or unwrap assets.

## App behavior before registration

- Preview metadata can make a pair visible for review.
- Mint, wrap, and unwrap actions stay locked until the onchain registry confirms the pair.
- If governance revokes a pair, CipherWrap keeps the row visible and labels it as revoked so users understand why writes are unavailable.
- The integration snippet generator keeps the registry check in the generated code so downstream apps do not trust stale local metadata.
