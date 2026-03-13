"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";

function initialsForValue(value?: string) {
  if (!value) return "..";
  const v = value.trim().replace(/^@/, "").replace(/^0x/i, "");
  if (!v) return "..";
  return v.slice(0, 2).toUpperCase();
}

function avatarForAddress(address?: string) {
  if (!address) return "av-cream";
  const last = address.toLowerCase().replace(/^0x/, "").slice(-1);
  const n = Number.parseInt(last, 16);
  const mod = Number.isNaN(n) ? 0 : n % 5;
  if (mod === 0) return "av-gold";
  if (mod === 1) return "av-teal";
  if (mod === 2) return "av-blue";
  if (mod === 3) return "av-cream";
  return "av-red";
}

export function Avatar({
  src,
  alt,
  addressHint,
  label,
  size = 36,
  className
}: {
  src?: string;
  alt?: string;
  addressHint?: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const baseClass = `avatar ${className ?? ""}`.trim();
  const colorClass = avatarForAddress(addressHint ?? label);
  const initials = initialsForValue(label ?? addressHint);

  if (src && src.trim()) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <div className={baseClass} style={{ width: size, height: size }}>
        <img className="avatar-img" src={src} alt={alt ?? "avatar"} />
      </div>
    );
  }

  return (
    <div className={`${baseClass} ${colorClass}`} style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}
