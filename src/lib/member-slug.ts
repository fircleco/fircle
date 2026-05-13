import { type Prisma } from "../../generated/prisma"

export function slugifyMemberText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : "member"
}

export function getMemberSlugBase(name: string, nickname?: string | null): string {
  const source = nickname?.trim() ? nickname : name
  return slugifyMemberText(source)
}

export async function resolveUniqueMemberSlug(
  db: Prisma.TransactionClient,
  familyId: string,
  baseSlug: string,
): Promise<string> {
  let suffix = 0

  while (suffix < 1000) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
    const existing = await db.familyMember.findFirst({
      where: {
        familyId,
        slug: candidate,
      },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Could not resolve a unique member slug")
}
