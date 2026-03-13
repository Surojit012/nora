"use client";

import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-14 border-b border-border bg-background">
      <div className="mx-auto flex h-full w-full max-w-[1060px] items-center justify-between px-4 lg:px-6">
        <Link href="/" className="logo" style={{ padding: 0 }}>
          <Logo title="nora" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/new"
            className="hidden rounded-[20px] bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-cta sm:inline-flex"
          >
            New Post
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
