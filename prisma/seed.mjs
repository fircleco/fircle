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

const familySeedSlug = "shittabey-family";
const seedHostDomains = [
  {
    domain: "localhost",
    isPrimary: true,
  },
  {
    domain: `${familySeedSlug}.fircle.app`,
    isPrimary: false,
  },
];

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

function collectMentionRanges(content, displayName) {
  const token = `@${displayName}`;
  const ranges = [];
  let fromIndex = 0;

  while (fromIndex < content.length) {
    const start = content.indexOf(token, fromIndex);
    if (start === -1) {
      break;
    }

    ranges.push({
      start,
      end: start + token.length,
    });
    fromIndex = start + token.length;
  }

  return ranges;
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

async function upsertUser(familyId, email, hashedPassword) {
  const existingUser = await db.user.findFirst({
    where: {
      familyId,
      email,
    },
  });

  if (existingUser) {
    return db.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
      },
    });
  }

  return db.user.create({
    data: {
      familyId,
      email,
      password: hashedPassword,
    },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  const family = await db.family.upsert({
    where: { slug: familySeedSlug },
    update: {
      name: "Shittabey",
      description: "A close-knit family sharing memories, photos, and updates.",
    },
    create: {
      name: "Shittabey",
      slug: familySeedSlug,
      description: "A close-knit family sharing memories, photos, and updates.",
    },
  });

  const verifiedAt = new Date();

  for (const hostDomain of seedHostDomains) {
    await db.domain.upsert({
      where: { domain: hostDomain.domain },
      update: {
        familyId: family.id,
        isPrimary: hostDomain.isPrimary,
        verifiedAt,
      },
      create: {
        familyId: family.id,
        domain: hostDomain.domain,
        isPrimary: hostDomain.isPrimary,
        verifiedAt,
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
    const user = await upsertUser(family.id, userInput.email, hashedPassword);
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

  await upsertUser(family.id, duplicateEmailUser.email, hashedPassword);

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

  // ── Posts ────────────────────────────────────────────────────────────────────

  const now = Date.now();

  const postFixtures = [
    // ── Emma Shittabey ──────────────────────────────────────────────────────
    {
      authorName: "Emma Shittabey",
      caption: "Family game night is back on this Friday! @Noah Shittabey please don't forget the snacks this time 😅",
      type: "TEXT",
      createdAt: new Date(now - 1 * 60 * 60 * 1000),
      mentions: ["Noah Shittabey"],
      media: [],
    },
    {
      authorName: "Emma Shittabey",
      caption: "Baked Grandma Evelyn's famous lemon cake for the first time. Not bad for a first try!",
      type: "PHOTO",
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      mentions: [],
      media: [
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=1280&h=720&fit=crop",
          caption: "Homemade lemon cake on the kitchen counter",
          sortOrder: 0,
        },
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1280&h=720&fit=crop",
          caption: "A slice of the lemon cake on a plate",
          sortOrder: 1,
        },
      ],
    },

    // ── Noah Shittabey ──────────────────────────────────────────────────────
    {
      authorName: "Noah Shittabey",
      caption: "Finished putting together the new bookshelf. Took three hours and one minor injury but we got there. @Emma Shittabey — your turn to decide what goes on it.",
      type: "TEXT",
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
      mentions: ["Emma Shittabey"],
      media: [],
    },
    {
      authorName: "Noah Shittabey",
      caption: "Saturday morning hike with @Lily Shittabey and @Logan Ross. The views were absolutely worth it.",
      type: "PHOTO",
      createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      mentions: ["Lily Shittabey", "Logan Ross"],
      media: [
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&h=720&fit=crop",
          caption: "Mountain trail at sunrise",
          sortOrder: 0,
        },
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&h=720&fit=crop",
          caption: "Panoramic valley view from the summit",
          sortOrder: 1,
        },
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1280&h=720&fit=crop",
          caption: "Forest path through pine trees",
          sortOrder: 2,
        },
      ],
    },

    // ── Lily Shittabey ──────────────────────────────────────────────────────
    {
      authorName: "Lily Shittabey",
      caption: "Just got my exam results back — passed with distinction! Couldn't have done it without the support from this whole family 🎉",
      type: "TEXT",
      createdAt: new Date(now - 30 * 60 * 1000),
      mentions: [],
      media: [],
    },
    {
      authorName: "Lily Shittabey",
      caption: "Quick clip from our pottery class. @Ava Kim this one's for you — told you I'd share it!",
      type: "VIDEO",
      createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      mentions: ["Ava Kim"],
      media: [
        {
          type: "VIDEO",
          url: "https://www.w3schools.com/html/mov_bbb.mp4",
          caption: "Hands shaping clay on a pottery wheel",
          durationMs: 45000,
          sortOrder: 0,
        },
      ],
    },

    // ── Logan Ross ──────────────────────────────────────────────────────────
    {
      authorName: "Logan Ross",
      caption: "Anyone up for a barbecue this weekend? I'm thinking Sunday afternoon. @Noah Shittabey already volunteered to man the grill.",
      type: "TEXT",
      createdAt: new Date(now - 4 * 60 * 60 * 1000),
      mentions: ["Noah Shittabey"],
      media: [],
    },
    {
      authorName: "Logan Ross",
      caption: "Weekend in the city. Highlights: street food, live music, and getting completely lost twice.",
      type: "MIXED",
      createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
      mentions: [],
      media: [
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&h=720&fit=crop",
          caption: "City skyline at dusk",
          sortOrder: 0,
        },
        {
          type: "VIDEO",
          url: "https://www.w3schools.com/html/movie.mp4",
          caption: "Street musician performing on a busy corner",
          durationMs: 32000,
          sortOrder: 1,
        },
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1280&h=720&fit=crop",
          caption: "Food market stalls lit up at night",
          sortOrder: 2,
        },
      ],
    },

    // ── Ava Kim ─────────────────────────────────────────────────────────────
    {
      authorName: "Ava Kim",
      caption: "So grateful to the Shittabey family for making me feel like one of their own. @Emma Shittabey your hospitality is unmatched!",
      type: "TEXT",
      createdAt: new Date(now - 5 * 60 * 60 * 1000),
      mentions: ["Emma Shittabey"],
      media: [],
    },
    {
      authorName: "Ava Kim",
      caption: "Pottery class recap! @Lily Shittabey this was such a fun idea. We're definitely going back.",
      type: "MIXED",
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      mentions: ["Lily Shittabey"],
      media: [
        {
          type: "IMAGE",
          url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1280&h=720&fit=crop",
          caption: "Completed pottery pieces drying on a shelf",
          sortOrder: 0,
        },
        {
          type: "VIDEO",
          url: "https://www.w3schools.com/html/mov_bbb.mp4",
          caption: "Timelapse of shaping a bowl on the wheel",
          durationMs: 22000,
          sortOrder: 1,
        },
      ],
    },
  ];

  // Build a memberId lookup: name → familyMember.id
  const memberIdByName = new Map();
  for (const [name, user] of usersByName.entries()) {
    const member = await db.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: user.id } },
      select: { id: true },
    });
    if (member) memberIdByName.set(name, member.id);
  }

  let postsSeeded = 0;

  for (const fixture of postFixtures) {
    const authorMemberId = memberIdByName.get(fixture.authorName);
    if (!authorMemberId) continue;

    // Idempotency: skip if this member already has posts
    const existingCount = await db.post.count({ where: { authorMemberId } });
    if (existingCount > 0) continue;

    const post = await db.post.create({
      data: {
        caption: fixture.caption,
        type: fixture.type,
        authorMemberId,
        createdAt: fixture.createdAt,
      },
    });

    if (fixture.media.length > 0) {
      await db.postMedia.createMany({
        data: fixture.media.map((m) => ({
          postId: post.id,
          type: m.type,
          provider: "seed",
          bucket: "seed",
          objectKey: m.url,
          url: m.url,
          mimeType: m.type === "VIDEO" ? "video/mp4" : "image/jpeg",
          sizeBytes: 0,
          durationMs: m.durationMs ?? null,
          caption: m.caption ?? null,
          sortOrder: m.sortOrder,
        })),
      });
    }

    postsSeeded++;
  }

  // ── Post Likes ─────────────────────────────────────────────────────────────

  const seededPosts = await db.post.findMany({
    where: {
      authorMember: {
        familyId: family.id,
      },
    },
    select: {
      id: true,
      caption: true,
      authorMemberId: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "asc" },
    ],
  });

  const memberIds = Array.from(memberIdByName.values()).sort();

  // Rebuild post mentions deterministically for fixture-backed posts.
  const postMentionsToCreate = [];
  const mentionedPostIds = new Set();

  for (const fixture of postFixtures) {
    if (!Array.isArray(fixture.mentions) || fixture.mentions.length === 0) {
      continue;
    }

    const authorMemberId = memberIdByName.get(fixture.authorName);
    if (!authorMemberId) {
      continue;
    }

    const matchingPost = seededPosts.find(
      (post) => post.authorMemberId === authorMemberId && post.caption === fixture.caption,
    );
    if (!matchingPost) {
      continue;
    }

    for (const mentionedMemberName of fixture.mentions) {
      const mentionedMemberId = memberIdByName.get(mentionedMemberName);
      if (!mentionedMemberId) {
        throw new Error(
          `Missing mentioned member for fixture post "${fixture.caption}": ${mentionedMemberName}`,
        );
      }

      const ranges = collectMentionRanges(fixture.caption, mentionedMemberName);
      if (ranges.length === 0) {
        throw new Error(
          `Could not find mention token @${mentionedMemberName} in fixture caption: ${fixture.caption}`,
        );
      }

      for (const range of ranges) {
        postMentionsToCreate.push({
          postId: matchingPost.id,
          mentionedMemberId,
          start: range.start,
          end: range.end,
        });
      }
    }

    mentionedPostIds.add(matchingPost.id);
  }

  if (mentionedPostIds.size > 0) {
    await db.postMention.deleteMany({
      where: {
        postId: {
          in: Array.from(mentionedPostIds),
        },
      },
    });
  }

  if (postMentionsToCreate.length > 0) {
    await db.postMention.createMany({
      data: postMentionsToCreate,
      skipDuplicates: true,
    });
  }

  // Make likes deterministic and idempotent: reset likes for seeded posts, then recreate.
  await db.postLike.deleteMany({
    where: {
      postId: {
        in: seededPosts.map((post) => post.id),
      },
    },
  });

  const likesToCreate = [];

  for (let postIndex = 0; postIndex < seededPosts.length; postIndex += 1) {
    const post = seededPosts[postIndex];

    for (let memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) {
      const memberId = memberIds[memberIndex];
      const shouldLike = (postIndex + memberIndex) % 2 === 0;

      if (!shouldLike) continue;

      likesToCreate.push({
        postId: post.id,
        memberIdWhoLiked: memberId,
      });
    }
  }

  if (likesToCreate.length > 0) {
    await db.postLike.createMany({
      data: likesToCreate,
      skipDuplicates: true,
    });
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  const postIdByCaption = new Map(
    seededPosts.map((post) => [post.caption ?? "", post.id]),
  );

  const commentFixtures = [
    {
      key: "lily-results-emma",
      postCaption:
        "Just got my exam results back — passed with distinction! Couldn't have done it without the support from this whole family 🎉",
      authorName: "Emma Shittabey",
      content: "You worked for this, @Lily Shittabey. We are all ridiculously proud of you.",
      mentions: ["Lily Shittabey"],
      createdAt: new Date(now - 28 * 60 * 1000),
    },
    {
      key: "lily-results-noah",
      postCaption:
        "Just got my exam results back — passed with distinction! Couldn't have done it without the support from this whole family 🎉",
      authorName: "Noah Shittabey",
      content: "Distinction deserves celebratory pancakes this weekend, @Lily Shittabey.",
      mentions: ["Lily Shittabey"],
      createdAt: new Date(now - 26 * 60 * 1000),
    },
    {
      key: "game-night-noah",
      postCaption:
        "Family game night is back on this Friday! @Noah Shittabey please don't forget the snacks this time 😅",
      authorName: "Noah Shittabey",
      content: "The snacks are already on the shopping list, @Emma Shittabey. No promises about my card strategy though.",
      mentions: ["Emma Shittabey"],
      createdAt: new Date(now - 50 * 60 * 1000),
    },
    {
      key: "barbecue-emma",
      postCaption:
        "Anyone up for a barbecue this weekend? I'm thinking Sunday afternoon. @Noah Shittabey already volunteered to man the grill.",
      authorName: "Emma Shittabey",
      content: "Sunday works for me, @Logan Ross. I'll bring the salad and lemonade.",
      mentions: ["Logan Ross"],
      createdAt: new Date(now - 3 * 60 * 60 * 1000 + 10 * 60 * 1000),
    },
    {
      key: "barbecue-ava",
      postCaption:
        "Anyone up for a barbecue this weekend? I'm thinking Sunday afternoon. @Noah Shittabey already volunteered to man the grill.",
      authorName: "Ava Kim",
      content: "Count me in, @Logan Ross. I can bring dessert if no one has claimed it yet.",
      mentions: ["Logan Ross"],
      createdAt: new Date(now - 3 * 60 * 60 * 1000 + 18 * 60 * 1000),
    },
    {
      key: "pottery-lily-emma",
      postCaption:
        "Pottery class recap! @Lily Shittabey this was such a fun idea. We're definitely going back.",
      authorName: "Emma Shittabey",
      content: "Next time I want a full family pottery leaderboard, @Ava Kim.",
      mentions: ["Ava Kim"],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    },
    {
      key: "lily-results-ava-reply",
      postCaption:
        "Just got my exam results back — passed with distinction! Couldn't have done it without the support from this whole family 🎉",
      authorName: "Ava Kim",
      content: "Pancakes and a framed printout of the result, honestly, @Noah Shittabey.",
      mentions: ["Noah Shittabey"],
      parentKey: "lily-results-noah",
      createdAt: new Date(now - 24 * 60 * 1000),
    },
    {
      key: "game-night-emma-reply",
      postCaption:
        "Family game night is back on this Friday! @Noah Shittabey please don't forget the snacks this time 😅",
      authorName: "Emma Shittabey",
      content: "Documenting this promise so we can all refer back to it later, @Noah Shittabey.",
      mentions: ["Noah Shittabey"],
      parentKey: "game-night-noah",
      createdAt: new Date(now - 46 * 60 * 1000),
    },
    {
      key: "barbecue-logan-reply",
      postCaption:
        "Anyone up for a barbecue this weekend? I'm thinking Sunday afternoon. @Noah Shittabey already volunteered to man the grill.",
      authorName: "Logan Ross",
      content: "Dessert is officially yours, @Ava Kim. I'll handle the music and chairs.",
      mentions: ["Ava Kim"],
      parentKey: "barbecue-ava",
      createdAt: new Date(now - 3 * 60 * 60 * 1000 + 24 * 60 * 1000),
    },
    {
      key: "pottery-lily-reply",
      postCaption:
        "Pottery class recap! @Lily Shittabey this was such a fun idea. We're definitely going back.",
      authorName: "Lily Shittabey",
      content: "Only if we agree not to compare our wobbly bowls afterward, @Emma Shittabey.",
      mentions: ["Emma Shittabey"],
      parentKey: "pottery-lily-emma",
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    },
  ];

  await db.commentLike.deleteMany({
    where: {
      comment: {
        postId: {
          in: seededPosts.map((post) => post.id),
        },
      },
    },
  });

  await db.comment.deleteMany({
    where: {
      postId: {
        in: seededPosts.map((post) => post.id),
      },
    },
  });

  const commentIdByKey = new Map();

  for (const fixture of commentFixtures) {
    const postId = postIdByCaption.get(fixture.postCaption);
    const authorMemberId = memberIdByName.get(fixture.authorName);
    const parentCommentId = fixture.parentKey
      ? commentIdByKey.get(fixture.parentKey)
      : null;

    if (!postId || !authorMemberId) {
      continue;
    }

    if (fixture.parentKey && !parentCommentId) {
      continue;
    }

    const comment = await db.comment.create({
      data: {
        postId,
        authorMemberId,
        parentCommentId,
        content: fixture.content,
        createdAt: fixture.createdAt,
      },
      select: {
        id: true,
      },
    });

    commentIdByKey.set(fixture.key, comment.id);
  }

  const commentMentionsToCreate = [];

  for (const fixture of commentFixtures) {
    if (!Array.isArray(fixture.mentions) || fixture.mentions.length === 0) {
      continue;
    }

    const commentId = commentIdByKey.get(fixture.key);
    if (!commentId) {
      continue;
    }

    for (const mentionedMemberName of fixture.mentions) {
      const mentionedMemberId = memberIdByName.get(mentionedMemberName);
      if (!mentionedMemberId) {
        throw new Error(
          `Missing mentioned member for fixture comment "${fixture.key}": ${mentionedMemberName}`,
        );
      }

      const ranges = collectMentionRanges(fixture.content, mentionedMemberName);
      if (ranges.length === 0) {
        throw new Error(
          `Could not find mention token @${mentionedMemberName} in fixture comment content: ${fixture.content}`,
        );
      }

      for (const range of ranges) {
        commentMentionsToCreate.push({
          commentId,
          mentionedMemberId,
          start: range.start,
          end: range.end,
        });
      }
    }
  }

  if (commentMentionsToCreate.length > 0) {
    await db.commentMention.createMany({
      data: commentMentionsToCreate,
      skipDuplicates: true,
    });
  }

  const seededComments = await db.comment.findMany({
    where: {
      postId: {
        in: seededPosts.map((post) => post.id),
      },
    },
    select: {
      id: true,
      authorMemberId: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  const commentLikesToCreate = [];

  for (let commentIndex = 0; commentIndex < seededComments.length; commentIndex += 1) {
    const comment = seededComments[commentIndex];

    for (let memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) {
      const memberId = memberIds[memberIndex];
      const shouldLike =
        memberId !== comment.authorMemberId && (commentIndex + memberIndex) % 3 === 0;

      if (!shouldLike) {
        continue;
      }

      commentLikesToCreate.push({
        commentId: comment.id,
        memberIdWhoLiked: memberId,
      });
    }
  }

  if (commentLikesToCreate.length > 0) {
    await db.commentLike.createMany({
      data: commentLikesToCreate,
      skipDuplicates: true,
    });
  }

  console.log("Seed complete");
  console.log(`Family: ${family.name} (${family.id})`);
  console.log(`Users seeded: ${usersFromMocks.length + 1}`);
  console.log(`Invites seeded: ${inviteFixtures.length}`);
  console.log(`Posts seeded: ${postsSeeded}`);
  console.log(`Post mentions seeded: ${postMentionsToCreate.length}`);
  console.log(`Post likes seeded: ${likesToCreate.length}`);
  console.log(`Comments seeded: ${seededComments.length}`);
  console.log(`Comment mentions seeded: ${commentMentionsToCreate.length}`);
  console.log(`Comment likes seeded: ${commentLikesToCreate.length}`);
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
