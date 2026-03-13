"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

type WalletUser = {
  username: string;
};

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { connected, account } = useWallet();
  const pathname = usePathname();
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function checkWalletIdentity() {
      if (!connected || !account?.address) return;

      const walletAddress = account.address.toString();
      const response = await fetch(
        `/user/by-wallet?wallet_address=${encodeURIComponent(walletAddress)}`,
        { cache: "no-store" }
      );

      if (!mountedRef.current) return;

      if (response.status === 404 && !isPublicPath(pathname)) {
        router.replace("/onboarding");
        return;
      }

      if (response.ok && pathname.startsWith("/onboarding")) {
        const user = (await response.json()) as WalletUser;
        router.replace(`/profile/${user.username}`);
      }
    }

    void checkWalletIdentity();
  }, [connected, account?.address, pathname, router]);

  return <>{children}</>;
}
