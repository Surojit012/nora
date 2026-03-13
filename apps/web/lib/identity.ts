import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UserRow = {
  id: string;
  username: string;
  bio: string | null;
  avatar: string | null;
  cover: string | null;
  created_at: string;
  wallet_address: string;
  followers_count: number | null;
};

export type PublicUser = {
  id: string;
  username: string;
  bio: string;
  avatar: string;
  cover: string;
  created_at: string;
  followers: number;
  wallet_address?: string;
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeWalletAddress(value: string): string {
  return value.trim().toLowerCase();
}

function validateUsername(value: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    bio: user.bio ?? "",
    avatar: user.avatar ?? "",
    cover: user.cover ?? "",
    created_at: user.created_at,
    followers: user.followers_count ?? 0,
    wallet_address: user.wallet_address
  };
}

function mapSupabaseError(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    if (error.message.includes("users_username_key")) {
      return new Error("Username is already taken.");
    }
    if (error.message.includes("users_wallet_address_key")) {
      return new Error("Wallet already has an account.");
    }
    return new Error("User already exists.");
  }

  return new Error(error.message || "Database error.");
}

export async function signupUser(input: {
  username: string;
  bio?: string;
  avatar?: string;
  cover?: string;
  wallet_address: string;
}): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  const bio = (input.bio ?? "").trim();
  const avatar = (input.avatar ?? "").trim();
  const cover = (input.cover ?? "").trim();
  const walletAddress = normalizeWalletAddress(input.wallet_address);

  if (!validateUsername(username)) {
    throw new Error("Username must be 3-24 chars: lowercase letters, numbers, underscore.");
  }
  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .insert({
      username,
      bio,
      avatar,
      cover,
      wallet_address: walletAddress
    })
    .select("*")
    .single();

  if (error) throw mapSupabaseError(error);
  return toPublicUser(data as UserRow);
}

export async function loginUser(input: {
  wallet_address: string;
}): Promise<{ token: string; user: PublicUser }> {
  const walletAddress = normalizeWalletAddress(input.wallet_address);
  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  const user = await getUserByWalletAddress(walletAddress);
  if (!user) {
    throw new Error("Account not found for this wallet.");
  }

  return { token: randomBytes(24).toString("hex"), user };
}

export async function getUserByUsername(usernameInput: string): Promise<PublicUser | null> {
  const username = normalizeUsername(usernameInput);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data ? toPublicUser(data as UserRow) : null;
}

export async function getUserByWalletAddress(walletAddressInput: string): Promise<PublicUser | null> {
  const walletAddress = normalizeWalletAddress(walletAddressInput);
  if (!walletAddress) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data ? toPublicUser(data as UserRow) : null;
}

export async function updateUserByWalletAddress(
  walletAddressInput: string,
  input: { bio?: string; avatar?: string; cover?: string }
): Promise<PublicUser> {
  const walletAddress = normalizeWalletAddress(walletAddressInput);
  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  const patch: { bio?: string; avatar?: string; cover?: string } = {};
  if (typeof input.bio === "string") patch.bio = input.bio.trim();
  if (typeof input.avatar === "string") patch.avatar = input.avatar.trim();
  if (typeof input.cover === "string") patch.cover = input.cover.trim();
  if (Object.keys(patch).length === 0) {
    throw new Error("Nothing to update.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("wallet_address", walletAddress)
    .select("*")
    .single();

  if (error) throw mapSupabaseError(error);
  return toPublicUser(data as UserRow);
}
