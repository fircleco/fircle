"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader,
  Plus,
  Send,
  ShieldAlert,
  TriangleAlert,
  X,
  More
} from "~/components/ui/icons";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ButtonGroup, ButtonGroupSeparator } from "~/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { reusableInviteSummarySchema } from "~/lib/invite-schemas";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type LifecycleState = "valid" | "expired" | "claimed" | "revoked";
type ReusableLifecycleState = "valid" | "revoked" | "invalid";

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
  isReusable: z.boolean().optional().default(false),
  isClaimInvite: z.boolean(),
  claimMember: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
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

const emailDeliveryResultSchema = z
  .object({
    status: z.enum(["sent", "skipped", "failed"]),
    reasonCode: z.string().optional(),
    message: z.string().optional(),
    acceptedAt: z.string().optional(),
  })
  .nullable()
  .optional();

const createdInviteSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(["OPEN", "EMAIL_BOUND"]),
  invitedEmail: z.string().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
  emailDelivery: emailDeliveryResultSchema,
});

const reusableStatusBadgeStyles: Record<ReusableLifecycleState, string> = {
  valid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  revoked: "border-destructive/30 bg-destructive/10 text-destructive",
  invalid: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

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

function buildPendingInviteLink(code: string, isClaimInvite: boolean) {
  const path = isClaimInvite ? `/auth/claim/${code}` : `/auth/invite/${code}`;

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function formatStatus(status: LifecycleState) {
  if (status === "valid") {
    return "Pending";
  }

  return status[0]!.toUpperCase() + status.slice(1);
}

function formatReusableStatus(status: ReusableLifecycleState) {
  if (status === "valid") {
    return "Active";
  }

  if (status === "revoked") {
    return "Revoked";
  }

  return "Unavailable";
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

function formatActorName(name: string | null | undefined, email: string | null | undefined) {
  return name ?? email ?? "Someone";
}

export default function InvitesPage() {
  const trpcUtils = api.useUtils();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showFamilyLinkPanel, setShowFamilyLinkPanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [expiry, setExpiry] = useState<CreateExpiryOption>(14);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copyFeedbackKey, setCopyFeedbackKey] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [emailDelivery, setEmailDelivery] = useState<{
    status: "sent" | "skipped" | "failed";
    reasonCode?: string;
    message?: string;
  } | null>(null);
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [familyLinkError, setFamilyLinkError] = useState<string | null>(null);
  const [familyLinkCopyKey, setFamilyLinkCopyKey] = useState<string | null>(null);

  const managementContext = api.family.getManagementContext.useQuery(undefined, {
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

  const reusableInviteQuery = api.invite.getActiveReusableInvite.useQuery(
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
      setCreatedInviteId(parsedCreatedInvite.data.id);
      setEmailDelivery(parsedCreatedInvite.data.emailDelivery ?? null);
      setCreateError(null);
      await trpcUtils.invite.listInvites.invalidate();
    },
    onError: (error) => {
      setCreateError(error.message);
    },
  });

  const retryEmailSend = api.invite.retryEmailSend.useMutation({
    onSuccess: (result) => {
      setEmailDelivery(result.emailDelivery);
    },
    onError: (error) => {
      setEmailDelivery({
        status: "failed",
        message: error.message,
      });
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

  const resetReusableInvite = api.invite.resetReusableInvite.useMutation({
    onSuccess: async (result) => {
      const parsedReusableInvite = reusableInviteSummarySchema.safeParse(result);
      if (!parsedReusableInvite.success) {
        setFamilyLinkError("Family invite link was reset, but response parsing failed.");
        return;
      }

      setFamilyLinkError(null);
      setShowFamilyLinkPanel(true);
      await Promise.all([
        trpcUtils.invite.getActiveReusableInvite.invalidate(),
        trpcUtils.invite.listInvites.invalidate(),
      ]);
    },
    onError: (error) => {
      setFamilyLinkError(error.message);
    },
  });

  const invites = useMemo(() => {
    const parsedInvites = inviteListSchema.safeParse(invitesQuery.data);
    return parsedInvites.success ? parsedInvites.data : [];
  }, [invitesQuery.data]);
  const reusableInvite = useMemo(() => {
    const parsedReusableInvite = reusableInviteSummarySchema.nullable().safeParse(
      reusableInviteQuery.data ?? null,
    );
    return parsedReusableInvite.success ? parsedReusableInvite.data : null;
  }, [reusableInviteQuery.data]);
  const familyLinkPanelVisible = showFamilyLinkPanel;
  const historyInvites = useMemo(
    () => invites.filter((invite) => !invite.isReusable && invite.lifecycleState !== "valid"),
    [invites],
  );
  const pendingInvites = useMemo(
    () => invites.filter((invite) => !invite.isReusable && invite.lifecycleState === "valid"),
    [invites],
  );

  const reusableHistoryItems = useMemo(() => {
    if (!reusableInvite || reusableInvite.useCount === 0) {
      return [];
    }

    return [
      {
        id: `${reusableInvite.id}:history`,
        activityAt: reusableInvite.lastUsedAt ?? reusableInvite.createdAt,
        title: "Someone joined via Family Invite Link",
        subtitle: reusableInvite.lastUsedAt
          ? `Last used ${formatDate(reusableInvite.lastUsedAt)} · Total joins ${reusableInvite.useCount}`
          : `Created ${formatDate(reusableInvite.createdAt)} · Total joins ${reusableInvite.useCount}`,
        status: reusableInvite.lifecycleState,
      },
    ];
  }, [reusableInvite]);

  const visiblePendingInvites = pendingInvites;
  const visibleHistoryInvites = useMemo(() => {
    return [...historyInvites].sort((a, b) => {
      const aTimestamp = (a.claimedAt ?? a.createdAt).getTime();
      const bTimestamp = (b.claimedAt ?? b.createdAt).getTime();
      return bTimestamp - aTimestamp;
    });
  }, [historyInvites]);
  const combinedHistoryItems = useMemo(() => {
    const inviteHistoryItems = visibleHistoryInvites.map((invite) => ({
      kind: "invite" as const,
      id: invite.id,
      type: invite.type,
      isClaimInvite: invite.isClaimInvite,
      invitedEmail: invite.invitedEmail,
      createdAt: invite.createdAt,
      claimedBy: invite.claimedBy,
      lifecycleState: invite.lifecycleState,
      activityAt: invite.claimedAt ?? invite.createdAt,
    }));

    const familyLinkHistoryItems = reusableHistoryItems.map((item) => ({
      kind: "family-link" as const,
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      activityAt: item.activityAt,
    }));

    return [...inviteHistoryItems, ...familyLinkHistoryItems].sort(
      (a, b) => b.activityAt.getTime() - a.activityAt.getTime(),
    );
  }, [reusableHistoryItems, visibleHistoryInvites]);
  const showAllEmptyState =
    visiblePendingInvites.length === 0 &&
    combinedHistoryItems.length === 0 &&
    reusableInvite === null;

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
    setEmailDelivery(null);
    setCreatedInviteId(null);
  }

  function closeFamilyLinkPanel() {
    setShowFamilyLinkPanel(false);
    setFamilyLinkError(null);
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

  async function handleResetFamilyLink() {
    if (!selectedFamilyId) {
      setFamilyLinkError("No family context was found for your account.");
      return;
    }

    await resetReusableInvite.mutateAsync({ familyId: selectedFamilyId });
  }

  async function handleCopyFamilyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFamilyLinkCopyKey(value);
      window.setTimeout(() => setFamilyLinkCopyKey(null), 1200);
    } catch {
      setFamilyLinkCopyKey(null);
    }
  }

  const familyInviteLinkUrl = reusableInvite ? buildInviteLink(reusableInvite.code) : null;
  const familyLinkAgeDays = reusableInvite
    ? Math.floor((Date.now() - new Date(reusableInvite.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const showFamilyLinkRotationReminder = Boolean(reusableInvite && reusableInvite.lifecycleState === "valid" && familyLinkAgeDays >= 90);

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
          <ButtonGroup aria-label="Invite actions" className="w-full sm:w-auto">
            <Button
              type="button"
              onClick={() => {
                setShowCreatePanel(true);
                setShowFamilyLinkPanel(false);
              }}
              disabled={!canManageInvites}
              className="sm:min-w-32"
            >
              <Plus data-icon="inline-start" />
              Create Invite
            </Button>
            <ButtonGroupSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManageInvites}
                  aria-label="More invite actions"
                  className="px-3"
                >
                  <More data-icon="inline-start" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 rounded-xl" align="end">
                <DropdownMenuItem
                  className="cursor-pointer items-start"
                  onSelect={() => {
                    setShowFamilyLinkPanel(true);
                    setShowCreatePanel(false);
                  }}
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Family Link</p>
                    <p className="text-muted-foreground text-xs">Invite via Family Invite Link</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
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

      {canManageInvites && familyLinkPanelVisible ? (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-base">Family Invite Link</h3>
              <p className="text-muted-foreground text-xs">
                Keep one reusable family onboarding link active until you intentionally reset it.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closeFamilyLinkPanel}>
              <X className="size-4" />
            </Button>
          </div>

          {reusableInviteQuery.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader className="size-4 animate-spin" />
              Loading family invite link...
            </p>
          ) : reusableInvite ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                    reusableStatusBadgeStyles[reusableInvite.lifecycleState],
                  )}
                >
                  {formatReusableStatus(reusableInvite.lifecycleState)}
                </span>
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Family Link
                </Badge>
                <span className="text-muted-foreground text-xs">
                  Created {formatDate(reusableInvite.createdAt)}
                </span>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <p className="font-medium text-sm">Current or last created family invite link</p>
                {familyInviteLinkUrl ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={familyInviteLinkUrl} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCopyFamilyLink(familyInviteLinkUrl)}
                    >
                      {familyLinkCopyKey === familyInviteLinkUrl ? (
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
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {reusableInvite.lifecycleState === "valid"
                    ? "Valid until reset"
                    : "This family invite link is no longer active. Reset to create a new one."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-muted-foreground text-xs">Usage</p>
                  <p className="mt-1 font-medium text-sm">
                    {reusableInvite.useCount === 1 ? "Used 1 time" : `Used ${reusableInvite.useCount} times`}
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-muted-foreground text-xs">Last used</p>
                  <p className="mt-1 font-medium text-sm">{formatDate(reusableInvite.lastUsedAt)}</p>
                </div>
              </div>

              {showFamilyLinkRotationReminder ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Consider rotating this link</p>
                      <p className="text-xs">
                        This family invite link is over 90 days old. Resetting it will invalidate older shares and create a fresh link.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={handleResetFamilyLink}
                  disabled={resetReusableInvite.isPending}
                >
                  {resetReusableInvite.isPending ? "Resetting..." : reusableInvite.lifecycleState === "valid" ? "Reset family link" : "Create new family link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card/60 p-6 text-center">
              <p className="font-medium text-sm">No family invite link yet.</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Create your first reusable family invite link to onboard multiple people with one shareable link.
              </p>
              <div className="mt-4">
                <Button type="button" onClick={handleResetFamilyLink} disabled={resetReusableInvite.isPending || !selectedFamilyId}>
                  {resetReusableInvite.isPending ? "Creating..." : "Create family link"}
                </Button>
              </div>
            </div>
          )}

          {familyLinkError ? <p className="text-destructive text-sm">{familyLinkError}</p> : null}
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
              {emailDelivery?.status === "sent" ? (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  <p className="text-xs">Invite email sent to {inviteEmail.trim() || "recipient"}.</p>
                </div>
              ) : emailDelivery?.status === "skipped" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-xs">Email not sent automatically</p>
                      <p className="text-xs">{emailDelivery.message ?? "Share the link above manually."}</p>
                    </div>
                  </div>
                </div>
              ) : emailDelivery?.status === "failed" ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-xs">Email failed to send</p>
                      <p className="text-xs">{emailDelivery.message ?? "Copy the link above and share it manually."}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (!createdInviteId) return;
                        retryEmailSend.mutate({ inviteId: createdInviteId });
                      }}
                      disabled={retryEmailSend.isPending || !createdInviteId}
                    >
                      {retryEmailSend.isPending ? (
                        <>
                          <Loader className="mr-1 size-4 animate-spin" aria-hidden="true" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-1 size-4" aria-hidden="true" />
                          Resend email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
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
              const inviteLink = buildPendingInviteLink(invite.code, invite.isClaimInvite);
              const copyKey = `pending:${invite.id}`;
              const purposeLabel = invite.isClaimInvite
                ? "Claim link"
                : invite.isReusable
                  ? "Family Link"
                  : "Open invite";
              const claimForLabel = invite.claimMember?.name ?? "Profile unavailable";

              return (
                <li key={invite.id} className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        {purposeLabel}
                      </Badge>
                      {invite.type === "EMAIL_BOUND" ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Email-bound
                        </Badge>
                      ) : null}
                      {invite.isClaimInvite ? (
                        <span className="text-muted-foreground">
                          For {claimForLabel}
                        </span>
                      ) : null}
                      {invite.type === "EMAIL_BOUND" && invite.invitedEmail ? (
                        <span className="text-muted-foreground">
                          {invite.invitedEmail}
                        </span>
                      ) : null}
                    </div>

                    <div className="relative overflow-hidden rounded-xl border bg-muted/20 pr-[12.5rem]">
                      <div className="overflow-x-auto scrollbar px-3 py-3 font-mono text-xs whitespace-nowrap">
                        {inviteLink}
                      </div>

                      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />

                      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-2">
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

                    <p className="text-muted-foreground text-xs">
                      Created by {invite.createdBy.name ?? invite.createdBy.email ?? "Unknown"} · Expires {formatDate(invite.expiresAt)}
                    </p>
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
        ) : combinedHistoryItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invite history yet.</p>
        ) : (
          <ul className="space-y-2">
            {combinedHistoryItems.map((item) => {
              if (item.kind === "invite") {
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm">
                        {item.claimedBy ? (
                          item.isClaimInvite ? (
                            `${formatActorName(item.claimedBy.name, item.claimedBy.email)} claimed their member profile`
                          ) : item.type === "OPEN" ? (
                            `${formatActorName(item.claimedBy.name, item.claimedBy.email)} joined via open invite`
                          ) : (
                            `${formatActorName(item.claimedBy.name, item.claimedBy.email)} claimed their invite`
                          )
                        ) : (
                          item.invitedEmail ?? "Invite updated"
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Created {formatDate(item.createdAt)}
                        {item.claimedBy
                          ? ` · Accepted by ${item.claimedBy.name ?? item.claimedBy.email ?? "Unknown"}`
                          : ""}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                        statusBadgeStyles[item.lifecycleState],
                      )}
                    >
                      {formatStatus(item.lifecycleState)}
                    </span>
                  </li>
                );
              }

              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs">{item.subtitle}</p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                      reusableStatusBadgeStyles[item.status],
                    )}
                  >
                    Family Link
                  </span>
                </li>
              );
            })}
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
