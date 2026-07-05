# CipherWrap bounty submission

## What is live

CipherWrap is a registry-first workbench for the official Zama Sepolia ERC-20 to ERC-7984 wrapper pairs. The app reads the onchain registry, merges it with documented metadata, locks unsafe write actions until registry confirmation, and exposes the full test lifecycle from one screen.

Verified flows in the current build:

1. Onchain registry load shows 9 registry-backed pairs.
2. Mintable mock pairs can mint public ERC-20 test tokens.
3. Public ERC-20 approval is separated from wrapping so users can see each transaction status.
4. Wrapping converts the approved public amount into confidential ERC-7984 units.
5. `confidentialBalanceOf` reads the encrypted balance handle.
6. User decryption is live and verified through the relayer EIP-712 flow after stripping the `EIP712Domain` type before `signTypedData`.
7. Arbitrary ERC-7984 balance checks use the same user-decrypt path for non-selected tokens.
8. Unwrap requests submit encrypted amounts and parse the receipt event to stage the request id and amount handle.
9. The UI keeps a transaction and proof history with Sepolia Etherscan links for mint, approve, wrap, unwrap request, and finalize transactions.

## Developer value

The integration snippet panel now generates a selected-pair handoff that includes:

- Registry validation through `isConfidentialTokenValid`.
- Public ERC-20 approval and `wrap` helpers.
- Confidential balance handle reads for user decryption.
- Unwrap request and finalize helpers.
- Injected wallet provider setup with ethers v6.

This makes CipherWrap useful as both a demo app and a reference integration for teams that want to compose with official wrappers instead of deploying isolated assets.

## Known finalization limitations

Unwrap request creation is implemented and receipt parsing is wired. Finalization still depends on the public decrypt proof being available from the Zama public decrypt flow. The app provides fields for clear amount and proof bytes, validates the finalize arguments locally, and submits `finalizeUnwrap` when proof material is supplied. If the proof is not yet available from the relayer flow, users can inspect the staged request id and amount handle but should not expect finalization to complete.

## Demo path

1. Connect a Sepolia wallet.
2. Select a registry-valid mock pair such as cUSDCMock.
3. Mint mock public tokens.
4. Approve wrapper spend.
5. Wrap the approved amount.
6. Run user decryption and confirm the private balance in the lifecycle timeline.
7. Request unwrap and inspect the staged request id.
8. Open Etherscan links from transaction history.
9. Copy the integration snippet for the selected pair.

## Verification notes

- `confidentialBalanceOf` targets the wrapper address and current wallet account.
- User decryption signs typed data with `EIP712Domain` removed from the `types` object for ethers v6 compatibility.
- Finalize argument helpers normalize bytes32 request ids, integer clear amounts, and proof bytes before calling the contract.
