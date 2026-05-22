"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader,
  Plus,
  ShieldAlert,
  X,
} from "~/components/ui/icons";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type LifecycleState = "valid" | "expired" | "claimed" | "revoked";

const managementContextSchema = z.object({
  family: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).nullable(),
  canManageInvites: z.boolean(),
});

const inviteListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(["OPEN", "EMAIL_BOUND"]),
  invitedEmail: z.string().nullable(),
  status: z.enum(["PENDING", "CLAIMED", "EXPIRED", "REVOKED"]),
  lifecycleState: z.enum(["valid", "expired", "claimed", "revoked"]),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  createdBy: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  claimedAt: z.date().nullable(),
  claimedBy: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable(),
});

const inviteListSchema = z.array(inviteListItemSchema);

const createdInviteSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(["OPEN", "EMAIL_BOUND"]),
  invitedEmail: z.string().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

const statusBadgeStyles: Record<LifecycleState, string> = {
  valid: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  claimed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
  revoked: "border-destructive/30 bg-destructive/10 text-destructive",
};

const createExpiryOptions = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
] as const;

type CreateExpiryOption = (typeof createExpiryOptions)[number]["value"];

function buildInviteLink(code: string) {
  if (typeof window === "undefined") {
    return `/auth/invite/${code}`;
  }

  return new URL(`/auth/invite/${code}`, window.location.origin).toString();
}

function formatStatus(status: LifecycleState) {
  if (status === "valid") {
    return "Pending";
  }

  return status[0]!.toUpperCase() + status.slice(1);
}

function formatInviteType(type: "OPEN" | "EMAIL_BOUND") {
  return type === "EMAIL_BOUND" ? "Email-bound" : "Open";
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Never";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvitesPage() {
  const trpcUtils = api.useUtils();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [expiry, setExpiry] = useState<CreateExpiryOption>(14);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copyFeedbackKey, setCopyFeedbackKey] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const parsedManagementContext = useMemo(
    () => managementContextSchema.safeParse(managementContext.data as unknown),
    [managementContext.data],
  );

  const managementContextData = parsedManagementContext.success
    ? parsedManagementContext.data
    : null;

  const selectedFamilyId = managementContextData?.family?.id;
  const canManageInvites = managementContextData?.canManageInvites ?? false;

  const invitesQuery = api.invite.listInvites.useQuery(
    { familyId: selectedFamilyId ?? "" },
    {
      enabled: Boolean(selectedFamilyId) && canManageInvites,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const createInvite = api.invite.createInvite.useMutation({
    onSuccess: async (createdInviteResult) => {
      const parsedCreatedInvite = createdInviteSchema.safeParse(createdInviteResult);
      if (!parsedCreatedInvite.success) {
        setCreateError("Invite was created, but response parsing failed.");
        return;
      }

      setGeneratedCode(parsedCreatedInvite.data.code);
      setGeneratedLink(buildInviteLink(parsedCreatedInvite.data.code));
      setCreateError(null);
      await trpcUtils.invite.listInvites.invalidate();
    },
    onError: (error) => {
      setCreateError(error.message);
    },
  });

  const revokeInvite = api.invite.revokeInvite.useMutation({
    onSuccess: async () => {
      setRevokeError(null);
      setRevokingInviteId(null);
      await trpcUtils.invite.listInvites.invalidate();
    },
    onError: (error) => {
      setRevokeError(error.message);
    },
  });

  const invites = useMemo(() => {
    const parsedInvites = inviteListSchema.safeParse(invitesQuery.data);
    return parsedInvites.success ? parsedInvites.data : [];
  }, [invitesQuery.data]);
  const historyInvites = useMemo(
    () => invites.filter((invite) => invite.lifecycleState !== "valid"),
    [invites],
  );
  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.lifecycleState === "valid"),
    [invites],
  );

  const visiblePendingInvites = pendingInvites;
  const visibleHistoryInvites = historyInvites;
  const showAllEmptyState =
    visiblePendingInvites.length === 0 && visibleHistoryInvites.length === 0;

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedbackKey(key);
      window.setTimeout(() => setCopyFeedbackKey(null), 1200);
    } catch {
      setCopyFeedbackKey(null);
    }
  }

  function closeCreatePanel() {
    setShowCreatePanel(false);
    setInviteEmail("");
    setExpiry(14);
    setGeneratedLink(null);
    setGeneratedCode(null);
    setCreateError(null);
  }

  async function handleGenerateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFamilyId) {
      setCreateError("No family context was found for your account.");
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    await createInvite.mutateAsync({
      familyId: selectedFamilyId,
      type: normalizedEmail.length > 0 ? "EMAIL_BOUND" : "OPEN",
      invitedEmail: normalizedEmail.length > 0 ? normalizedEmail : undefined,
      expiresInDays: expiry,
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="font-semibold text-xl tracking-tight">Invites</h2>
          <p className="text-muted-foreground text-sm">
            Create and manage invite links for family membership.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowCreatePanel(true)}
            disabled={!canManageInvites}
          >
            <Plus className="mr-1 size-4" />
            Create Invite
          </Button>
        </div>
      </header>

      {managementContext.isLoading ? (
        <section className="rounded-2xl border bg-card/70 p-5">
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader className="size-4 animate-spin" />
            Loading invite access...
          </p>
        </section>
      ) : null}

      {!managementContext.isLoading && !managementContextData?.family ? (
        <section className="rounded-2xl border border-dashed bg-card/60 p-6 text-center">
          <p className="font-medium text-sm">No family membership found for your account.</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Ask a family owner/admin to invite you to a family first.
          </p>
        </section>
      ) : null}

      {!managementContext.isLoading && managementContextData?.family && !canManageInvites ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Only owners and admins can create or revoke invites.
            </p>
          </div>
        </section>
      ) : null}

      {showCreatePanel && canManageInvites ? (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-base">New Invite</h3>
              <p className="text-muted-foreground text-xs">
                Generate a shareable invite link for a new family member.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closeCreatePanel}>
              <X className="size-4" />
            </Button>
          </div>

          <form action="#" onSubmit={handleGenerateInvite} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email (optional)
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Invite by email (optional)"
                disabled={createInvite.isPending}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Expiry</legend>
              <div className="flex flex-wrap gap-2">
                {createExpiryOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setExpiry(option.value)}
                    disabled={createInvite.isPending}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      expiry === option.value
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {createError ? <p className="text-destructive text-sm">{createError}</p> : null}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={createInvite.isPending || !selectedFamilyId}>
                {createInvite.isPending ? "Generating..." : "Generate Invite"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreatePanel}
                disabled={createInvite.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>

          {generatedLink ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="font-medium text-emerald-700 text-sm dark:text-emerald-300">
                Invite link generated
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={generatedLink} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyText(`generated:${generatedLink}`, generatedLink)}
                >
                  {copyFeedbackKey === `generated:${generatedLink}` ? (
                    <>
                      <Check className="mr-1 size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 size-4" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
              {generatedCode ? (
                <p className="text-emerald-700 text-xs dark:text-emerald-300">
                  Code: <span className="font-mono">{generatedCode}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {canManageInvites && invitesQuery.error ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-destructive text-sm">Could not load invites: {invitesQuery.error.message}</p>
        </section>
      ) : null}

      {canManageInvites && !invitesQuery.isLoading && showAllEmptyState ? (
        <section className="rounded-2xl border border-dashed bg-card/60 p-6 text-center">
          <p className="font-medium text-sm">No invites yet. Create one to add family members.</p>
        </section>
      ) : null}

      {canManageInvites ? (
        <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-base">Pending</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {invitesQuery.isLoading ? "..." : visiblePendingInvites.length}
          </span>
        </div>

        {invitesQuery.isLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader className="size-4 animate-spin" />
            Loading pending invites...
          </p>
        ) : visiblePendingInvites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending invites.</p>
        ) : (
          <ul className="space-y-3">
            {visiblePendingInvites.map((invite) => {
              const inviteLink = buildInviteLink(invite.code);
              const copyKey = `pending:${invite.id}`;

              return (
                <li key={invite.id} className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border bg-muted px-2 py-0.5 text-muted-foreground">
                          {formatInviteType(invite.type)} invite
                        </span>
                        {invite.type === "EMAIL_BOUND" ? (
                          <span className="text-muted-foreground">
                            {invite.invitedEmail ?? "No email specified"}
                          </span>
                        ) : null}
                      </div>
                      <p className="break-all font-mono text-xs">
                        <span className="text-muted-foreground text-xs">Invite link: </span>
                        {inviteLink}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Created by {invite.createdBy.name ?? invite.createdBy.email ?? "Unknown"} · Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(copyKey, inviteLink)}
                      >
                        {copyFeedbackKey === copyKey ? (
                          <>
                            <Check className="mr-1 size-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-1 size-4" />
                            Copy link
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setRevokingInviteId(invite.id)}
                          disabled={revokeInvite.isPending}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>

                  {revokingInviteId === invite.id ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">
                        Revoke this invite? This cannot be undone.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revokeInvite.mutate({ inviteId: invite.id })}
                          disabled={revokeInvite.isPending}
                        >
                          {revokeInvite.isPending ? "Revoking..." : "Confirm revoke"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRevokingInviteId(null);
                            setRevokeError(null);
                          }}
                          disabled={revokeInvite.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                      {revokeError ? (
                        <p className="mt-2 text-destructive text-xs">{revokeError}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        </section>
      ) : null}

      {canManageInvites ? (
        <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">History</h3>

        {invitesQuery.isLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader className="size-4 animate-spin" />
            Loading invite history...
          </p>
        ) : visibleHistoryInvites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invite history yet.</p>
        ) : (
          <ul className="space-y-2">
            {visibleHistoryInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-2 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm">
                    {invite.invitedEmail ?? "No email specified"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Created {formatDate(invite.createdAt)}
                    {invite.claimedBy
                      ? ` · Accepted by ${invite.claimedBy.name ?? invite.claimedBy.email ?? "Unknown"}`
                      : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                    statusBadgeStyles[invite.lifecycleState],
                  )}
                >
                  {formatStatus(invite.lifecycleState)}
                </span>
              </li>
            ))}
          </ul>
        )}
        </section>
      ) : null}

      <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-muted-foreground text-xs">
        <div className="flex md:items-center gap-2">
          <ShieldAlert className="mt-0.5 md:mt-0 size-4 shrink-0" />
          <p>
            Invite actions are server-validated. Owner/admin role is required for create and revoke
            operations.
          </p>
        </div>
      </div>
    </div>
  );
}
