"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { fetchUserByWallet } from "@/lib/identityClient";
import type { PublicUser } from "@/lib/identity";
import { Avatar } from "@/components/Avatar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  dynamicProfile?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    )
  },
  {
    href: "/explore",
    label: "Explore",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <circle cx="8" cy="8" r="5" />
        <path d="M14 14l3 3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        width="18"
        height="18"
      >
        <path
          d="M15 17H5a2 2 0 01-2-2V5a2 2 0 012-2h6l4 4v8a2 2 0 01-2 2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7 9h6M7 12h4" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/bookmarks",
    label: "Bookmarks",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        width="18"
        height="18"
      >
        <path
          d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2H5V5zM3 9h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    href: "/profile",
    label: "Profile",
    dynamicProfile: true,
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        width="18"
        height="18"
      >
        <circle cx="10" cy="8" r="3" />
        <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        width="18"
        height="18"
      >
        <path
          d="M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 10a4.5 4.5 0 0 0-.08-.84l1.67-1.3-1.6-2.77-2 .81a4.6 4.6 0 0 0-1.46-.84l-.3-2.1H8.27l-.3 2.1c-.52.2-1.02.48-1.46.84l-2-.81-1.6 2.77 1.67 1.3A4.6 4.6 0 0 0 5.5 10c0 .29.03.57.08.84l-1.67 1.3 1.6 2.77 2-.81c.44.36.94.64 1.46.84l.3 2.1h3.06l.3-2.1c.52-.2 1.02-.48 1.46-.84l2 .81 1.6-2.77-1.67-1.3c.05-.27.08-.55.08-.84Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
];

function shortenAddress(value?: string) {
  if (!value) return "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const { connected, account, wallets, connect, disconnect } = useWallet();
  const [profileHref, setProfileHref] = useState("/profile");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    async function resolveProfileHref() {
      const walletAddress = account?.address?.toString();
      if (!walletAddress) {
        setProfileHref("/profile");
        setUser(null);
        return;
      }

      try {
        const u = await fetchUserByWallet(walletAddress);
        setProfileHref(`/profile/${u.username}`);
        setUser(u);
      } catch {
        setProfileHref("/onboarding");
        setUser(null);
      }
    }

    void resolveProfileHref();
  }, [account?.address]);

  const petraWallet = wallets.find((wallet) => wallet.name.toLowerCase().includes("petra"))?.name;
  const firstWallet = wallets[0]?.name;

  const displayName = user?.username ? user.username : shortenAddress(account?.address?.toString());
  const handle = account?.address?.toString() ? `@${shortenAddress(account.address.toString())}` : "@disconnected";

  return (
    <>
      <Link href="/" className="logo">
        <Logo title="nora" />
        <span style={{
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--gold)',
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border2)',
          borderRadius: '4px',
          lineHeight: 1
        }}>
          Beta
        </span>
      </Link>

      <nav>
        {navItems.map((item) => {
          const href = item.dynamicProfile ? profileHref : item.href;
          const active = pathname === href;
          return (
            <Link key={`${item.href}-${item.label}`} href={href} className={`nav-item${active ? " active" : ""}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="nav-spacer" />

      <button
        type="button"
        className="post-btn"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.scrollTo(0, 0);
            window.dispatchEvent(new Event("nora:open-composer"));
          }
        }}
      >
        Post
      </button>

      <button
        type="button"
        className="nav-item"
        onClick={() => {
          if (connected && account?.address) {
            disconnect();
            return;
          }
          const targetWallet = petraWallet ?? firstWallet;
          if (targetWallet) void connect(targetWallet);
        }}
      >
        <span className="nav-icon">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path
              d="M3 7h14v10H3V7zM5 7V5a2 2 0 012-2h6a2 2 0 012 2v2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {connected && account?.address ? "Disconnect" : "Connect wallet"}
      </button>

      <Link href={profileHref} className="profile-row">
        <Avatar
          src={user?.avatar || ""}
          alt={user?.username ? `${user.username} avatar` : "avatar"}
          addressHint={account?.address?.toString()}
          label={user?.username ? user.username : account?.address?.toString()}
          size={36}
        />
        <div>
          <div className="profile-name">{displayName}</div>
          <div className="profile-handle">{handle}</div>
        </div>
      </Link>
    </>
  );
}
