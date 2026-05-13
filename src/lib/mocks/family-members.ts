export type FamilyMemberStatus = "claimed" | "unclaimed";

export type MemberRole = "owner" | "admin" | "member";

export type FamilyMemberSummary = {
  id: string;
  name: string;
  nickname?: string;
  slug: string;
  status: FamilyMemberStatus;
  hasPendingClaimInvite?: boolean;
  role: MemberRole;
  avatarUrl?: string;
  addedByName: string;
  addedAtLabel: string;
};

export type FamilyMemberProfile = FamilyMemberSummary & {
  pendingClaimInvite?: {
    id: string;
    code: string;
    invitedEmail: string | null;
    expiresAt: Date;
  } | null;
  recentActivity: string[];
};

export type ClaimInvitePreview = {
  token: string;
  memberId: string;
  memberName: string;
  familyName: string;
  invitedByName: string;
  status: "valid" | "expired" | "claimed";
};

export const familyMembers: FamilyMemberSummary[] = [
  {
    id: "member-emma-shittabey",
    name: "Emma Shittabey",
    nickname: "Em",
    slug: "em",
    status: "claimed",
    role: "owner",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    addedByName: "System",
    addedAtLabel: "Joined 1y ago",
  },
  {
    id: "member-noah-shittabey",
    name: "Noah Shittabey",
    slug: "noah-shittabey",
    status: "claimed",
    role: "admin",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
    addedByName: "System",
    addedAtLabel: "Joined 1y ago",
  },
  {
    id: "member-lily-shittabey",
    name: "Lily Shittabey",
    slug: "lily-shittabey",
    status: "claimed",
    role: "member",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop",
    addedByName: "Emma Shittabey",
    addedAtLabel: "Joined 8mo ago",
  },
  {
    id: "member-evelyn-shittabey",
    name: "Evelyn Shittabey",
    nickname: "Evie",
    slug: "evie",
    status: "unclaimed",
    role: "member",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&h=240&fit=crop",
    addedByName: "Noah Shittabey",
    addedAtLabel: "Added 3mo ago",
  },
  {
    id: "member-logan-ross",
    name: "Logan Ross",
    slug: "logan-ross",
    status: "claimed",
    role: "member",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop",
    addedByName: "Emma Shittabey",
    addedAtLabel: "Joined 6mo ago",
  },
  {
    id: "member-nina-ross",
    name: "Nina Ross",
    slug: "nina-ross",
    status: "unclaimed",
    role: "member",
    addedByName: "Logan Ross",
    addedAtLabel: "Added 2mo ago",
  },
  {
    id: "member-ben-harper",
    name: "Ben Harper",
    slug: "ben-harper",
    status: "unclaimed",
    role: "member",
    avatarUrl:
      "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=240&h=240&fit=crop",
    addedByName: "Noah Shittabey",
    addedAtLabel: "Added 1mo ago",
  },
  {
    id: "member-ava-kim",
    name: "Ava Kim",
    nickname: "Av",
    slug: "av",
    status: "claimed",
    role: "member",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop",
    addedByName: "Emma Shittabey",
    addedAtLabel: "Joined 4mo ago",
  },
];

export const familyMemberProfiles: FamilyMemberProfile[] = familyMembers.map((member) => ({
  ...member,
  recentActivity: [
    "Tagged in a weekend dinner memory",
    "Mentioned in family planning chat",
    "Added to summer reunion list",
  ],
}));

export const claimInvitePreviews: ClaimInvitePreview[] = [
  {
    token: "claim-rose-001",
    memberId: "member-evelyn-shittabey",
    memberName: "Evelyn Shittabey",
    familyName: "The Shittabey Family",
    invitedByName: "Noah Shittabey",
    status: "valid",
  },
  {
    token: "claim-nina-002",
    memberId: "member-nina-ross",
    memberName: "Nina Ross",
    familyName: "The Shittabey Family",
    invitedByName: "Logan Ross",
    status: "expired",
  },
  {
    token: "claim-ben-003",
    memberId: "member-ben-harper",
    memberName: "Ben Harper",
    familyName: "The Shittabey Family",
    invitedByName: "Emma Shittabey",
    status: "claimed",
  },
];

export const getFamilyMemberProfileById = (memberId: string) =>
  familyMemberProfiles.find((member) => member.id === memberId);

export const getFamilyMemberProfileBySlug = (slug: string) =>
  familyMemberProfiles.find((member) => member.slug === slug);

export const getClaimInvitePreviewByToken = (token: string) =>
  claimInvitePreviews.find((preview) => preview.token === token);
