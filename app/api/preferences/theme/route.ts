import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user_preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireMutationAuth } from "@/lib/auth";
import { DEFAULT_THEME_ID, isValidThemeId } from "@/lib/themes/registry";
import { cookies } from "next/headers";

const THEME_COOKIE = "cartdex_theme";
const COOKIE_MAX_AGE = 31536000; // 1 year

export async function GET() {
  const row = db
    .select()
    .from(user_preferences)
    .where(eq(user_preferences.key, "theme"))
    .get();

  const theme = row?.value ?? DEFAULT_THEME_ID;
  return NextResponse.json({ theme });
}

export async function PUT(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  let body: { theme: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { theme } = body;
  if (typeof theme !== "string" || !isValidThemeId(theme)) {
    return NextResponse.json(
      { error: "Invalid theme. Valid values: snes, tatooine" },
      { status: 400 }
    );
  }

  db.insert(user_preferences)
    .values({ key: "theme", value: theme, updated_at: new Date().toISOString() })
    .onConflictDoUpdate({
      target: user_preferences.key,
      set: { value: theme, updated_at: new Date().toISOString() },
    })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // must be readable by the inline FOUC script
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true, theme });
}
