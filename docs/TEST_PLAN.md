# Test plan

## Automated

```bash
npm test
npm run build
```

Current coverage:

- Decimal amount parsing and formatting.
- Wrapper rounding and refund planning.
- Registry merge behavior.
- Unknown onchain pair handling.
- Coverage metric calculation.

## Manual Sepolia click-through

1. Open live app.
2. Connect Sepolia wallet.
3. Confirm registry scan updates onchain-backed count.
4. Select cUSDCMock.
5. Mint mock underlying.
6. Approve and wrap.
7. User-decrypt ERC-7984 balance.
8. Request unwrap.
9. Confirm request id and amount handle are parsed.
10. Paste another ERC-7984 address and run user-decrypt flow.

## Risks to verify

- Wallet signs correct EIP-712 payload for user decryption.
- Revoked registry pairs cannot be wrapped through the primary button.
- Amount rounding is visible before users submit wrap.
- Faucet disabled for restricted pairs.
