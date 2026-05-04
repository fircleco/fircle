export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export type Invite = {
  id: string;
  code: string;
  invitedEmail?: string;
  createdAt: string;
  expiresAt: string | null;
  status: InviteStatus;
  createdBy: string;
  acceptedBy?: string;
};

export const invites: Invite[] = [
  {
    id: "invite-001",
    code: "abc123xyz",
    invitedEmail: "gran@example.com",
    createdAt: "May 1, 2026",
    expiresAt: "May 31, 2026",
    status: "pending",
    createdBy: "Emma Shittabey",
  },
  {
    id: "invite-002",
    code: "def456uvw",
    createdAt: "Apr 28, 2026",
    expiresAt: "May 28, 2026",
    status: "pending",
    createdBy: "Noah Shittabey",
  },
  {
    id: "invite-003",
    code: "ghi789rst",
    invitedEmail: "ava.kim@example.com",
    createdAt: "Mar 10, 2026",
    expiresAt: "Apr 10, 2026",
    status: "accepted",
    createdBy: "Emma Shittabey",
    acceptedBy: "Ava Kim",
  },
  {
    id: "invite-004",
    code: "jkl012opq",
    invitedEmail: "nina.ross@example.com",
    createdAt: "Feb 14, 2026",
    expiresAt: "Mar 14, 2026",
    status: "expired",
    createdBy: "Logan Ross",
  },
  {
    id: "invite-005",
    code: "mno345lmn",
    createdAt: "Apr 15, 2026",
    expiresAt: "May 15, 2026",
    status: "revoked",
    createdBy: "Noah Shittabey",
  },
  {
    id: "invite-006",
    code: "pqr678hij",
    invitedEmail: "lily.Shittabey@example.com",
    createdAt: "Jan 5, 2026",
    expiresAt: "Feb 5, 2026",
    status: "accepted",
    createdBy: "Emma Shittabey",
    acceptedBy: "Lily Shittabey",
  },
];
