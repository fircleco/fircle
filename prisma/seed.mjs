import bcrypt from "bcryptjs";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SEED_PASSWORD = "Passw0rd!123";

const usersFromMocks = [
  {
    name: "Emma Shittabey",
    nickname: "Em",
    email: "emma.shittabey@example.com",
    role: "OWNER",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
  },
  {
    name: "Noah Shittabey",
    email: "noah.shittabey@example.com",
    role: "ADMIN",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
  },
  {
    name: "Lily Shittabey",
    email: "lily.shittabey@example.com",
    role: "MEMBER",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop",
  },
  {
    name: "Logan Ross",
    email: "logan.ross@example.com",
    role: "MEMBER",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop",
  },
  {
    name: "Ava Kim",
    nickname: "Av",
    email: "ava.kim@example.com",
    role: "MEMBER",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop",
  },
];

// This user is intentionally outside the family to test duplicate-email invite acceptance.
const duplicateEmailUser = {
  name: "Existing User",
  email: "existing-user@example.com",
};

const inviteFixtures = [
  {
    code: "abc123xyz",
    invitedEmail: "gran@example.com",
    createdAt: "May 1, 2026",
    expiresAt: "May 31, 2026",
    status: "PENDING",
    createdBy: "Emma Shittabey",
    claimedBy: null,
    claimedAt: null,
    revokedAt: null,
  },
  {
    code: "def456uvw",
    invitedEmail: null,
    createdAt: "Apr 28, 2026",
    expiresAt: "May 28, 2026",
    status: "PENDING",
    createdBy: "Noah Shittabey",
    claimedBy: null,
    claimedAt: null,
    revokedAt: null,
  },
  {
    code: "ghi789rst",
    invitedEmail: "ava.kim@example.com",
    createdAt: "Mar 10, 2026",
    expiresAt: "Apr 10, 2026",
    status: "CLAIMED",
    createdBy: "Emma Shittabey",
    claimedBy: "Ava Kim",
    claimedAt: "Mar 12, 2026",
    revokedAt: null,
  },
  {
    code: "jkl012opq",
    invitedEmail: "nina.ross@example.com",
    createdAt: "Feb 14, 2026",
    expiresAt: "Mar 14, 2026",
    status: "EXPIRED",
    createdBy: "Logan Ross",
    claimedBy: null,
    claimedAt: null,
    revokedAt: null,
  },
  {
    code: "mno345lmn",
    invitedEmail: null,
    createdAt: "Apr 15, 2026",
    expiresAt: "May 15, 2026",
    status: "REVOKED",
    createdBy: "Noah Shittabey",
    claimedBy: null,
    claimedAt: null,
    revokedAt: "Apr 16, 2026",
  },
  {
    code: "pqr678hij",
    invitedEmail: "lily.shittabey@example.com",
    createdAt: "Jan 5, 2026",
    expiresAt: "Feb 5, 2026",
    status: "CLAIMED",
    createdBy: "Emma Shittabey",
    claimedBy: "Lily Shittabey",
    claimedAt: "Jan 8, 2026",
    revokedAt: null,
  },
];

function parseDate(input) {
  return new Date(input);
}

function slugifyMemberText(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "member";
}

function getMemberSlugBase(name, nickname) {
  return slugifyMemberText((nickname && nickname.trim()) || name);
}

function resolveUniqueSeedSlug(usedSlugs, baseSlug) {
  let attempt = 0;

  while (attempt < 1000) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    if (!usedSlugs.has(candidate)) {
      usedSlugs.add(candidate);
      return candidate;
    }
    attempt += 1;
  }

  throw new Error("Could not resolve a unique slug for seed member");
}

async function upsertUser(email, hashedPassword) {
  return db.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
    },
    create: {
      email,
      password: hashedPassword,
    },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  let family = await db.family.findFirst({
    where: { name: "The Shittabey Family" },
  });

  if (!family) {
    family = await db.family.create({
      data: {
        name: "The Shittabey Family",
        description: "A close-knit family sharing memories, photos, and updates.",
      },
    });
  }

  const usersByName = new Map();

  const existingMemberSlugs = await db.familyMember.findMany({
    where: { familyId: family.id },
    select: { slug: true },
  });
  const usedSlugs = new Set(existingMemberSlugs.map((member) => member.slug));

  for (const userInput of usersFromMocks) {
    const user = await upsertUser(userInput.email, hashedPassword);
    usersByName.set(userInput.name, user);

    const existingMembership = await db.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: family.id,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      await db.familyMember.update({
        where: { id: existingMembership.id },
        data: {
          name: userInput.name,
          nickname: userInput.nickname ?? null,
          role: userInput.role,
          image: userInput.avatarUrl ?? null,
        },
      });
      usedSlugs.add(existingMembership.slug);
      continue;
    }

    const slugBase = getMemberSlugBase(userInput.name, userInput.nickname);
    const slug = resolveUniqueSeedSlug(usedSlugs, slugBase);

    await db.familyMember.create({
      data: {
        familyId: family.id,
        userId: user.id,
        name: userInput.name,
        nickname: userInput.nickname ?? null,
        slug,
        role: userInput.role,
        image: userInput.avatarUrl ?? null,
      },
    });
  }

  await upsertUser(duplicateEmailUser.email, hashedPassword);

  for (const fixture of inviteFixtures) {
    const createdBy = usersByName.get(fixture.createdBy);
    if (!createdBy) {
      throw new Error(`Missing createdBy user for invite ${fixture.code}: ${fixture.createdBy}`);
    }

    const claimedBy = fixture.claimedBy ? usersByName.get(fixture.claimedBy) : null;
    if (fixture.claimedBy && !claimedBy) {
      throw new Error(`Missing claimedBy user for invite ${fixture.code}: ${fixture.claimedBy}`);
    }

    await db.invite.upsert({
      where: { code: fixture.code },
      update: {
        code: fixture.code,
        familyId: family.id,
        type: fixture.invitedEmail ? "EMAIL_BOUND" : "OPEN",
        status: fixture.status,
        invitedEmail: fixture.invitedEmail,
        createdById: createdBy.id,
        claimedById: claimedBy?.id ?? null,
        createdAt: parseDate(fixture.createdAt),
        expiresAt: parseDate(fixture.expiresAt),
        claimedAt: fixture.claimedAt ? parseDate(fixture.claimedAt) : null,
        revokedAt: fixture.revokedAt ? parseDate(fixture.revokedAt) : null,
      },
      create: {
        code: fixture.code,
        familyId: family.id,
        type: fixture.invitedEmail ? "EMAIL_BOUND" : "OPEN",
        status: fixture.status,
        invitedEmail: fixture.invitedEmail,
        createdById: createdBy.id,
        claimedById: claimedBy?.id ?? null,
        createdAt: parseDate(fixture.createdAt),
        expiresAt: parseDate(fixture.expiresAt),
        claimedAt: fixture.claimedAt ? parseDate(fixture.claimedAt) : null,
        revokedAt: fixture.revokedAt ? parseDate(fixture.revokedAt) : null,
      },
    });
  }

  console.log("Seed complete");
  console.log(`Family: ${family.name} (${family.id})`);
  console.log(`Users seeded: ${usersFromMocks.length + 1}`);
  console.log(`Invites seeded: ${inviteFixtures.length}`);
  console.log(`Seed sign-in password for all users: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
