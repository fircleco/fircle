"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Check, CheckCircle2, Copy, Link2, Loader, User, UserRoundPlus } from "~/components/ui/icons";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { beginNavigationProgress } from "~/components/nav/navigation-progress";
import { createInstantPreviewUrl, resolveMediaMimeType } from "~/lib/media-compression";
import { api } from "~/trpc/react";

type UploadIntentItem = {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  readUrl: string;
};

const ACCEPTED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

function uploadFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading photo."));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.send(file);
  });
}

export default function AddMemberPage() {
  const router = useRouter();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberNickname, setMemberNickname] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [autoClaimInvite, setAutoClaimInvite] = useState<{
    code: string;
    invitedEmail: string | null;
  } | null>(null);
  const [isClaimLinkCopied, setIsClaimLinkCopied] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl] = useState<string | null>(null);
  const [isPreviewConverting, setIsPreviewConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPreviewSelectionRef = useRef(0);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedFamilyId = managementContext.data?.family?.id ?? null;
  const canManageMembers =
    managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";
  const showPermissionDenied =
    !managementContext.isLoading && selectedFamilyId && !canManageMembers;

  useEffect(() => {
    if (showPermissionDenied) {
      beginNavigationProgress();
      router.replace("/members");
    }
  }, [router, showPermissionDenied]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
      }
    };
  }, [selectedAvatarPreviewUrl]);

  const createMember = api.familyMember.createUnclaimedMember.useMutation();
  const updateMemberProfile = api.familyMember.updateMemberProfile.useMutation();

  const handleAvatarSelected = (file: File | null) => {
    if (!file) return;
    setFormError(null);

    if (!ACCEPTED_AVATAR_MIME_TYPES.has(resolveMediaMimeType(file))) {
      setFormError("Please select a supported image format (jpg, png, webp, heic, heif).");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setFormError("Avatar image exceeds the 15MB size limit.");
      return;
    }

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    const resolvedMimeType = resolveMediaMimeType(file);
    const shouldShowPreviewConversion =
      resolvedMimeType === "image/heic" || resolvedMimeType === "image/heif";

    const selectionId = ++avatarPreviewSelectionRef.current;
    setIsPreviewConverting(shouldShowPreviewConversion);
    const previewUrl = createInstantPreviewUrl(file, (upgradedPreviewUrl) => {
      if (avatarPreviewSelectionRef.current !== selectionId) {
        URL.revokeObjectURL(upgradedPreviewUrl);
        return;
      }

      setSelectedAvatarPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return upgradedPreviewUrl;
      });
      setIsPreviewConverting(false);
    }, () => {
      if (avatarPreviewSelectionRef.current !== selectionId) {
        return;
      }

      setIsPreviewConverting(false);
    });

    setSelectedAvatarFile(file);
    setSelectedAvatarPreviewUrl(previewUrl);
    setUploadProgress(0);
  };

  const handleRemoveAvatar = () => {
    avatarPreviewSelectionRef.current += 1;

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }
    setSelectedAvatarFile(null);
    setSelectedAvatarPreviewUrl(null);
    setUploadProgress(0);
    setIsPreviewConverting(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const normalizedName = memberName.trim();
    const normalizedNickname = memberNickname.trim();
    const normalizedEmail = memberEmail.trim();

    if (!normalizedName) {
      setFormError("Member name is required.");
      return;
    }

    if (!selectedFamilyId) {
      setFormError("No family context was found for your account.");
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const data = await createMember.mutateAsync({
        familyId: selectedFamilyId,
        name: normalizedName,
        nickname: normalizedNickname.length > 0 ? normalizedNickname : undefined,
        email: normalizedEmail.length > 0 ? normalizedEmail : undefined,
      });

      if (selectedAvatarFile) {
        const intentsResponse = await fetch("/api/uploads/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            familyId: selectedFamilyId,
            uploadFor: "avatar",
            memberId: data.id,
            files: [
              {
                fileName: selectedAvatarFile.name,
                mimeType: selectedAvatarFile.type,
                sizeBytes: selectedAvatarFile.size,
              },
            ],
          }),
        });

        const intentBody = (await intentsResponse.json()) as {
          intents?: UploadIntentItem[];
          error?: { message?: string };
        };

        if (!intentsResponse.ok || !intentBody.intents?.[0]) {
          throw new Error(intentBody.error?.message ?? "Failed to create avatar upload intent.");
        }

        const avatarIntent = intentBody.intents[0];
        await uploadFileWithProgress(
          avatarIntent.uploadUrl,
          selectedAvatarFile,
          avatarIntent.requiredHeaders,
          setUploadProgress,
        );

        await updateMemberProfile.mutateAsync({
          familyId: selectedFamilyId,
          memberId: data.id,
          name: normalizedName,
          image: avatarIntent.readUrl,
        });
      }

      setIsSubmitted(true);
      setAutoClaimInvite(
        data.claimInvite
          ? {
              code: data.claimInvite.code,
              invitedEmail: data.claimInvite.invitedEmail,
            }
          : null,
      );
      setIsClaimLinkCopied(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAnother = () => {
    avatarPreviewSelectionRef.current += 1;

    setMemberName("");
    setMemberNickname("");
    setMemberEmail("");
    setAutoClaimInvite(null);
    setIsClaimLinkCopied(false);
    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }
    setSelectedAvatarFile(null);
    setSelectedAvatarPreviewUrl(null);
    setUploadProgress(0);
    setIsPreviewConverting(false);
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

      {showPermissionDenied ? (
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-7">
          <Alert variant="destructive">
            <AlertCircle className="size-5" aria-hidden="true" />
            <AlertTitle>Permission denied</AlertTitle>
            <AlertDescription>
              Only family owners and admins can create member profiles.
            </AlertDescription>
          </Alert>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/members">Back to members</Link>
            </Button>
          </div>
        </section>
      ) : isSubmitted ? (
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleCopyClaimLink();
                      }}
                    >
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
                disabled={
                  isSaving ||
                  managementContext.isLoading ||
                  !selectedFamilyId ||
                  !canManageMembers
                }
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
                disabled={
                  isSaving ||
                  managementContext.isLoading ||
                  !selectedFamilyId ||
                  !canManageMembers
                }
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
                disabled={
                  isSaving ||
                  managementContext.isLoading ||
                  !selectedFamilyId ||
                  !canManageMembers
                }
              />
              {memberEmail.trim().length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  A claim invite link will be created automatically and bound to this email.
                </p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">Profile photo (optional)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  handleAvatarSelected(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
                <div className="relative shrink-0">
                  <Avatar className="size-12 border">
                    <AvatarImage
                      src={selectedAvatarPreviewUrl ?? undefined}
                      alt={memberName || "Profile photo"}
                    />
                    <AvatarFallback>
                      <User className="size-5 text-muted-foreground" aria-hidden="true" />
                    </AvatarFallback>
                  </Avatar>
                  {isPreviewConverting ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background">
                      <Loader className="size-4 animate-spin text-foreground" aria-hidden="true" />
                      <span className="sr-only">Converting image preview</span>
                    </div>
                  ) : null}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving || managementContext.isLoading || !selectedFamilyId || !canManageMembers}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    {selectedAvatarFile ? "Change photo" : "Choose photo"}
                  </Button>
                  {selectedAvatarFile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveAvatar}
                      disabled={isSaving}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              {selectedAvatarFile ? (
                <p className="text-xs text-muted-foreground">Selected: {selectedAvatarFile.name}</p>
              ) : null}
              {isSaving && uploadProgress > 0 ? (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Uploading photo: {uploadProgress}%</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                isSaving ||
                managementContext.isLoading ||
                !selectedFamilyId ||
                !canManageMembers
              }
            >
              {isSaving ? (
                <>
                  <Loader className="size-4 animate-spin" aria-hidden="true" />
                  {uploadProgress > 0 ? "Uploading..." : "Creating..."}
                </>
              ) : (
                "Create member"
              )}
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
