# CipherWrap submission assets

## Three-minute demo script

0:00 to 0:20
Introduce CipherWrap: a registry-first wrapper app for official ERC-20 to ERC-7984 pairs on Zama Sepolia.

0:20 to 0:50
Show the official pairs list, mock faucet count, and registry source-of-truth model.

0:50 to 1:40
Connect a wallet, select cUSDCMock, mint test tokens, approve the wrapper, and wrap into confidential ERC-7984 tokens.

1:40 to 2:20
Show verified user decryption, arbitrary ERC-7984 balance lookup for non-registry tokens, and the transaction history with Etherscan links.

2:20 to 3:00
Show `docs/SUBMISSION.md`, the integration snippet panel, and `docs/ADDING_PAIRS.md` so teams can copy the registry-first integration path.

## X thread draft

1/ CipherWrap turns Zama's official wrapper registry into a user-facing app.

Browse ERC-20 to ERC-7984 pairs, mint test assets, wrap, decrypt balances, and prepare unwraps from one place.

#ZamaDeveloperProgram @zama

2/ The goal is composability. Developers should use official wrappers instead of spinning up isolated test assets that do not work together.

3/ CipherWrap supports official Sepolia pairs, mock-token faucet flows, wrap and unwrap entry points, arbitrary ERC-7984 balance checks, and an add-pair process.

4/ Repo: https://github.com/kamalbuilds/cipherwrap
Demo: https://cipherwrap-self.vercel.app
