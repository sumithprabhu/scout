import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/models/UserProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Profile upsert helper — not in the original 4-route list, but /api/match needs
 * a profile to exist. Keyed by `identity` (email/session string) since there's
 * no auth yet. Skills are stored lowercased so they compare cleanly in the
 * match engine.
 *
 * POST /api/profile  Body: { identity: string, skills: string[], resumeText?: string }
 * GET  /api/profile?identity=...  -> the profile
 */
export async function POST(req: Request) {
  let body: { identity?: string; skills?: string[]; resumeText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.identity || !body.identity.trim()) {
    return NextResponse.json({ error: "identity is required" }, { status: 400 });
  }
  if (!Array.isArray(body.skills)) {
    return NextResponse.json({ error: "skills must be an array of strings" }, { status: 400 });
  }

  const skills = Array.from(
    new Set(body.skills.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
  );

  await connectDB();
  const profile = await UserProfile.findOneAndUpdate(
    { identity: body.identity.trim() },
    { $set: { skills, resumeText: body.resumeText ?? "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    id: String(profile._id),
    identity: profile.identity,
    skills: profile.skills,
  });
}

export async function GET(req: Request) {
  const identity = new URL(req.url).searchParams.get("identity");
  if (!identity) {
    return NextResponse.json({ error: "identity query param required" }, { status: 400 });
  }
  await connectDB();
  const profile = await UserProfile.findOne({ identity }).lean();
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: String(profile._id),
    identity: profile.identity,
    skills: profile.skills,
  });
}
