"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";

function shortenAddress(value?: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function WalletButton() {
  const { connected, account, wallets, connect, disconnect } = useWallet();

  const petraWallet = wallets.find((wallet) => wallet.name.toLowerCase().includes("petra"))?.name;
  const firstWallet = wallets[0]?.name;

  if (connected && account?.address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="btn-ghost"
      >
        {shortenAddress(account.address.toString())}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const targetWallet = petraWallet ?? firstWallet;
        if (targetWallet) {
          void connect(targetWallet);
        }
      }}
      className="btn-ghost"
    >
      Connect Wallet
    </button>
  );
}
