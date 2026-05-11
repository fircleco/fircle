import bcrypt from "bcryptjs";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SEED_PASSWORD = "Passw0rd!123";

const usersFromMocks = [
  { name: "Emma Shittabey", email: "emma.shittabey@example.com", role: "OWNER" },
  { name: "Noah Shittabey", email: "noah.shittabey@example.com", role: "ADMIN" },
  { name: "Lily Shittabey", email: "lily.shittabey@example.com", role: "MEMBER" },
  { name: "Logan Ross", email: "logan.ross@example.com", role: "MEMBER" },
  { name: "Ava Kim", email: "ava.kim@example.com", role: "MEMBER" },
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

async function upsertUser(email, name, hashedPassword) {
  return db.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
    },
    create: {
      name,
      email,
      password: hashedPassword,
    },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  const family = await db.family.upsert({
    where: { id: "seed-family-shittabey" },
    update: {
      name: "The Shittabey Family",
      description: "A close-knit family sharing memories, photos, and updates.",
    },
    create: {
      id: "seed-family-shittabey",
      name: "The Shittabey Family",
      description: "A close-knit family sharing memories, photos, and updates.",
    },
  });

  const usersByName = new Map();

  for (const userInput of usersFromMocks) {
    const user = await upsertUser(userInput.email, userInput.name, hashedPassword);
    usersByName.set(userInput.name, user);

    await db.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: family.id,
          userId: user.id,
        },
      },
      update: {
        role: userInput.role,
      },
      create: {
        familyId: family.id,
        userId: user.id,
        role: userInput.role,
      },
    });
  }

  await upsertUser(duplicateEmailUser.email, duplicateEmailUser.name, hashedPassword);

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
