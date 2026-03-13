import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/identity";

type RouteContext = {
  params: {
    username: string;
  };
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const username = context.params.username;
    const user = await getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user." },
      { status: 500 }
    );
  }
}
