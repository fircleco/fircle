"use client";

import { useState } from "react";
import { Copy, Check, Link2, X } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

type GenerateClaimLinkDialogProps = {
  memberId: string;
  memberName: string | null;
};

export function GenerateClaimLinkDialog({ memberId, memberName }: GenerateClaimLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createClaimLink = api.familyMember.createClaimLink.useMutation({
    onSuccess(data) {
      const url = `${window.location.origin}/auth/claim/${data.code}`;
      setClaimUrl(url);
      setError(null);
    },
    onError(err) {
      setError(err.message);
    },
  });

  const handleOpen = () => {
    setOpen(true);
    setEmail("");
    setClaimUrl(null);
    setCopied(false);
    setError(null);
  };

  const handleClose = () => {
    if (createClaimLink.isPending) return;
    setOpen(false);
  };

  const handleGenerate = () => {
    setError(null);
    createClaimLink.mutate({
      familyMemberId: memberId,
      invitedEmail: email.trim() || undefined,
    });
  };

  const handleCopy = async () => {
    if (!claimUrl) return;
    await navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        className="mt-3 w-full"
        size="sm"
        type="button"
        onClick={handleOpen}
      >
        Generate claim link
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Generate claim link"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-xl tracking-tight">Generate claim link</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {memberName
                    ? `Create a link for ${memberName} to claim this profile.`
                    : "Create a link for this person to claim this profile."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                aria-label="Close"
                disabled={createClaimLink.isPending}
              >
                <X className="size-4" />
              </Button>
            </header>

            {!claimUrl ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="claim-email" className="text-sm font-medium">
                    Email binding{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="claim-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={createClaimLink.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, only someone with this exact email can use the link.
                  </p>
                </div>

                {error ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={createClaimLink.isPending}
                  >
                    {createClaimLink.isPending ? "Generating…" : "Generate link"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={createClaimLink.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Claim link ready</p>
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="min-w-0 flex-1 truncate text-sm font-mono">{claimUrl}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with {memberName ?? "the member"} so they can claim their profile.
                    {email ? ` Only someone with ${email} can use it.` : " Anyone with the link can claim it."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="size-4" aria-hidden="true" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" aria-hidden="true" />
                        Copy link
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setClaimUrl(null);
                      setEmail("");
                    }}
                  >
                    Generate another
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
