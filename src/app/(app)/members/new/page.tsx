"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Link2, UserRoundPlus } from "~/components/ui/icons";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export default function AddMemberPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberNickname, setMemberNickname] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [autoClaimInvite, setAutoClaimInvite] = useState<{
    code: string;
    invitedEmail: string | null;
  } | null>(null);
  const [isClaimLinkCopied, setIsClaimLinkCopied] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedFamilyId = managementContext.data?.family?.id ?? null;

  const createMember = api.familyMember.createUnclaimedMember.useMutation({
    onSuccess: (data) => {
      setIsSubmitted(true);
      setFormError(null);
      setAutoClaimInvite(
        data.claimInvite
          ? {
              code: data.claimInvite.code,
              invitedEmail: data.claimInvite.invitedEmail,
            }
          : null,
      );
      setIsClaimLinkCopied(false);
    },
    onError(error) {
      setFormError(error.message);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = memberName.trim();
    const normalizedNickname = memberNickname.trim();
    const normalizedEmail = memberEmail.trim();
    const normalizedPhotoUrl = photoUrl.trim();

    if (!normalizedName) {
      setFormError("Member name is required.");
      return;
    }

    if (!selectedFamilyId) {
      setFormError("No family context was found for your account.");
      return;
    }

    setFormError(null);

    await createMember.mutateAsync({
      familyId: selectedFamilyId,
      name: normalizedName,
      nickname: normalizedNickname.length > 0 ? normalizedNickname : undefined,
      email: normalizedEmail.length > 0 ? normalizedEmail : undefined,
      image: normalizedPhotoUrl.length > 0 ? normalizedPhotoUrl : undefined,
    });
  };

  const handleAddAnother = () => {
    setMemberName("");
    setMemberNickname("");
    setMemberEmail("");
    setAutoClaimInvite(null);
    setIsClaimLinkCopied(false);
    setPhotoUrl("");
    setIsSubmitted(false);
    setFormError(null);
  };

  const autoClaimUrl = autoClaimInvite
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/claim/${autoClaimInvite.code}`
    : null;

  const handleCopyClaimLink = async () => {
    if (!autoClaimUrl) return;
    await navigator.clipboard.writeText(autoClaimUrl);
    setIsClaimLinkCopied(true);
    setTimeout(() => setIsClaimLinkCopied(false), 2000);
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">Add a family member</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Create an unclaimed profile so your family circle includes people who have not joined yet.
        </p>
      </header>

      {isSubmitted ? (
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="font-medium text-lg">Member profile created</h2>
              <p className="text-sm text-muted-foreground">
                {memberName || "This person"} was added as an unclaimed family member profile.
              </p>
              <p className="text-sm text-muted-foreground">
                They can claim this profile later using a claim invite.
              </p>
              {autoClaimInvite && autoClaimUrl ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium text-primary">Claim invite created automatically</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 px-2 py-2">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="min-w-0 flex-1 break-all font-mono text-xs sm:text-sm">{autoClaimUrl}</p>
                    <Button type="button" size="sm" variant="outline" onClick={handleCopyClaimLink}>
                      {isClaimLinkCopied ? (
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
                  </div>
                  {autoClaimInvite.invitedEmail ? (
                    <p className="mt-1 text-muted-foreground">
                      This link is email-bound to {autoClaimInvite.invitedEmail}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={handleAddAnother}>
              Add another member
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/members">Back to members</Link>
            </Button>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} action="#" className="rounded-3xl border bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-6 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <UserRoundPlus className="mt-0.5 size-4" aria-hidden="true" />
              <p>
                This creates an unclaimed profile only. The person does not need to be present now and
                can claim the account later.
              </p>
            </div>
          </div>

          {formError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Unable to create member</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {managementContext.isLoading ? (
            <Alert className="mb-6">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Loading family context</AlertTitle>
              <AlertDescription>
                We&apos;re checking which family you can add this member to.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="name"
                placeholder="For example: Evelyn Walker"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                required
                disabled={createMember.isPending || managementContext.isLoading || !selectedFamilyId}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">
                Nickname (optional)
              </label>
              <Input
                id="nickname"
                placeholder="For example: Nana"
                value={memberNickname}
                onChange={(event) => setMemberNickname(event.target.value)}
                disabled={createMember.isPending || managementContext.isLoading || !selectedFamilyId}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email (optional)
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@family.com"
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
                disabled={createMember.isPending || managementContext.isLoading || !selectedFamilyId}
              />
              {memberEmail.trim().length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  A claim invite link will be created automatically and bound to this email.
                </p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="photoUrl" className="text-sm font-medium">
                Photo URL (optional)
              </label>
              <Input
                id="photoUrl"
                placeholder="https://example.com/photo.jpg"
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
                disabled={createMember.isPending || managementContext.isLoading || !selectedFamilyId}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="submit" disabled={createMember.isPending || managementContext.isLoading || !selectedFamilyId}>
              {createMember.isPending ? "Creating..." : "Create member"}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/members">Back to members</Link>
            </Button>
          </div>

        </form>
      )}
    </section>
  );
}
