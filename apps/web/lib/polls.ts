import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function validateOptionIndex(optionIndex: number, optionsCount: number) {
  if (!Number.isInteger(optionIndex)) throw new Error("Invalid option index.");
  if (!Number.isInteger(optionsCount) || optionsCount < 2 || optionsCount > 4) {
    throw new Error("Invalid options count.");
  }
  if (optionIndex < 0 || optionIndex >= optionsCount) {
    throw new Error("Option out of range.");
  }
}

export async function getPollResults(args: {
  postId: string;
  optionsCount: number;
  voterAddress?: string;
}) {
  const postId = args.postId.trim();
  if (!postId) throw new Error("postId is required.");

  validateOptionIndex(0, args.optionsCount); // validates count range

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("poll_votes")
    .select("option_index,voter_address")
    .eq("post_id", postId);

  if (error) {
    throw new Error(`Poll read failed: ${error.message}`);
  }

  const counts = new Array(args.optionsCount).fill(0) as number[];
  let myVote: number | undefined;
  const normalizedVoter = args.voterAddress ? normalizeAddress(args.voterAddress) : "";

  for (const row of (data ?? []) as { option_index: number; voter_address: string }[]) {
    if (typeof row.option_index === "number" && row.option_index >= 0 && row.option_index < counts.length) {
      counts[row.option_index] += 1;
    }
    if (normalizedVoter && normalizeAddress(row.voter_address) === normalizedVoter) {
      myVote = row.option_index;
    }
  }

  const total = counts.reduce((a, b) => a + b, 0);

  return {
    counts,
    total,
    ...(typeof myVote === "number" ? { myVote } : {})
  };
}

export async function castPollVote(args: {
  postId: string;
  voterAddress: string;
  optionIndex: number;
  optionsCount: number;
}) {
  const postId = args.postId.trim();
  if (!postId) throw new Error("postId is required.");

  const voter = args.voterAddress.trim();
  if (!voter) throw new Error("voterAddress is required.");

  validateOptionIndex(args.optionIndex, args.optionsCount);

  const supabase = getSupabaseAdmin();

  const payload = {
    post_id: postId,
    voter_address: normalizeAddress(voter),
    option_index: args.optionIndex,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("poll_votes")
    .upsert(payload, { onConflict: "post_id,voter_address" });

  if (error) {
    throw new Error(`Poll vote failed: ${error.message}`);
  }

  return { ok: true };
}

