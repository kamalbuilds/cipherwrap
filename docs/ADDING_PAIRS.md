# Adding wrapper pairs

CipherWrap treats the onchain registry as source of truth.

1. Deploy or choose an ERC-20 token.
2. Deploy a valid ERC-7984 wrapper for that token.
3. Confirm the wrapper supports ERC-7984 interface detection.
4. Ask registry governance to register the pair.
5. Add temporary local metadata only for preview builds.
6. Remove preview metadata once the registry returns the pair as valid.

Validity is checked onchain before users wrap or unwrap assets.
