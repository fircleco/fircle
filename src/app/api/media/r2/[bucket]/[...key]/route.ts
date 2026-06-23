import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { tryGetStorageProvider } from "~/server/storage";

const familyKeyPattern = /^families\/([a-z0-9]+)\//;

function decodePathSegments(segments: string[] | undefined) {
  return (segments ?? []).map((segment) => decodeURIComponent(segment));
}

function getFamilyIdFromObjectKey(objectKey: string) {
  const match = familyKeyPattern.exec(objectKey);
  return match?.[1] ?? null;
}

const paramsSchema = z.object({
  bucket: z.string().min(1),
  key: z.array(z.string()).min(1),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bucket: string; key: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rawParams = await context.params;
  const parsed = paramsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const bucket = decodeURIComponent(parsed.data.bucket);
  const objectKey = decodePathSegments(parsed.data.key).join("/");

  const familyId = getFamilyIdFromObjectKey(objectKey);
  if (!familyId) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storage = await tryGetStorageProvider(familyId);
  if (!storage) {
    return NextResponse.json(
      { error: "Object storage is not configured for this family" },
      { status: 503 },
    );
  }

  const signedReadUrl = await storage.signReadUrl({
    provider: "r2",
    bucket,
    objectKey,
  });

  return NextResponse.redirect(signedReadUrl, { status: 302 });
}
