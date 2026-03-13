"use client";

import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { Logo } from "@/components/Logo";

export function Nav() {
  return (
    <header className="sticky top-0 z-10 mb-0 border-b border-border bg-background">
      <div className="flex items-center justify-between gap-3 px-1 py-3">
        <Link href="/" className="logo" style={{ padding: 0 }}>
          <Logo title="nora" />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/new" className="border border-border px-3 py-2 text-sm">
            New Post
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
