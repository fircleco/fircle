"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, Plus, ShieldAlert, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { invites, type InviteStatus } from "~/lib/mocks/invites";
import { cn } from "~/lib/utils";

const inviteBaseUrl = "https://fircle.app/auth/invite";

const statusBadgeStyles: Record<InviteStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
  revoked: "border-destructive/30 bg-destructive/10 text-destructive",
};

const createExpiryOptions = [
  { value: "7_days", label: "7 days" },
  { value: "30_days", label: "30 days" },
  { value: "no_expiry", label: "No expiry" },
] as const;

type CreateExpiryOption = (typeof createExpiryOptions)[number]["value"];

function buildInviteLink(code: string) {
  return `${inviteBaseUrl}/${code}`;
}

function formatStatus(status: InviteStatus) {
  return status[0]!.toUpperCase() + status.slice(1);
}

export default function InvitesPage() {
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [expiry, setExpiry] = useState<CreateExpiryOption>("7_days");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copyFeedbackKey, setCopyFeedbackKey] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [showEmptyPreview, setShowEmptyPreview] = useState(false);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [],
  );
  const historyInvites = useMemo(
    () => invites.filter((invite) => invite.status !== "pending"),
    [],
  );

  const visiblePendingInvites = showEmptyPreview ? [] : pendingInvites;
  const visibleHistoryInvites = showEmptyPreview ? [] : historyInvites;
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
    setExpiry("7_days");
    setGeneratedLink(null);
  }

  function handleGenerateInvite(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    const suffix = normalizedEmail.length > 0 ? normalizedEmail.split("@")[0] : "new-member";
    const code = `${suffix}-${Date.now().toString().slice(-6)}`;
    setGeneratedLink(buildInviteLink(code));
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
            variant="outline"
            onClick={() => setShowEmptyPreview((prev) => !prev)}
          >
            {showEmptyPreview ? "Show invite data" : "Preview empty state"}
          </Button>
          <Button type="button" onClick={() => setShowCreatePanel(true)}>
            <Plus className="mr-1 size-4" />
            Create Invite
          </Button>
        </div>
      </header>

      {showCreatePanel ? (
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
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Expiry</legend>
              <div className="flex flex-wrap gap-2">
                {createExpiryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExpiry(option.value)}
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

            <div className="flex items-center gap-2">
              <Button type="submit">Generate Invite</Button>
              <Button type="button" variant="outline" onClick={closeCreatePanel}>
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
            </div>
          ) : null}
        </section>
      ) : null}

      {showAllEmptyState ? (
        <section className="rounded-2xl border border-dashed bg-card/60 p-6 text-center">
          <p className="font-medium text-sm">No invites yet. Create one to add family members.</p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-base">Pending</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {visiblePendingInvites.length}
          </span>
        </div>

        {visiblePendingInvites.length === 0 ? (
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
                      <p className="text-muted-foreground text-xs">Invite link</p>
                      <p className="break-all font-mono text-xs">{inviteLink}</p>
                      <p className="text-muted-foreground text-xs">
                        Created by {invite.createdBy} · Expires {invite.expiresAt ?? "Never"}
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
                          onClick={() => setRevokingInviteId(null)}
                        >
                          Confirm revoke
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRevokingInviteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">History</h3>

        {visibleHistoryInvites.length === 0 ? (
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
                    Created {invite.createdAt}
                    {invite.acceptedBy ? ` · Accepted by ${invite.acceptedBy}` : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                    statusBadgeStyles[invite.status],
                  )}
                >
                  {formatStatus(invite.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-muted-foreground text-xs">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Static UI only: revoke, generate, and history interactions are visual mocks and do not
            persist data.
          </p>
        </div>
      </div>
    </div>
  );
}
