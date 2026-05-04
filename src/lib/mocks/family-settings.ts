export type InvitePolicy = "admin_only" | "any_member";

export type FamilySettings = {
  name: string;
  avatarUrl?: string;
  invitePolicy: InvitePolicy;
};

export const familySettings: FamilySettings = {
  name: "The Shittabey Family",
  avatarUrl: undefined,
  invitePolicy: "admin_only",
};
