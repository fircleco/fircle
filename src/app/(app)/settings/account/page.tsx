"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { AlertCircle, ArrowRight, Camera, Loader, Security, User } from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function slugifyMemberText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "member";
}

function getSlugFromSource(source: "name" | "nickname", name: string, nickname: string) {
  const primary = source === "nickname" ? nickname : name;
  const secondary = source === "nickname" ? name : nickname;
  const resolved = primary.trim().length > 0 ? primary : secondary;
  return slugifyMemberText(resolved);
}

function matchesDerivedSlug(currentSlug: string, baseSlug: string) {
  if (baseSlug.length === 0) {
    return false;
  }

  return currentSlug === baseSlug || currentSlug.startsWith(`${baseSlug}-`);
}

function resolveInitialSlugSource(currentSlug: string, name: string, nickname: string): "name" | "nickname" {
  const nameSlug = slugifyMemberText(name);
  const nicknameSlug = nickname.trim().length > 0 ? slugifyMemberText(nickname) : "";
  const matchesName = matchesDerivedSlug(currentSlug, nameSlug);
  const matchesNickname = matchesDerivedSlug(currentSlug, nicknameSlug);

  if (matchesNickname && !matchesName) {
    return "nickname";
  }

  if (matchesName && !matchesNickname) {
    return "name";
  }

  if (matchesNickname && nickname.trim().length > 0) {
    return "nickname";
  }

  return "name";
}

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
      if (!event.lengthComputable) {
        return;
      }

      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading avatar. Please try again."));
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

export default function AccountSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileNickname, setProfileNickname] = useState("");
  const [profileSlug, setProfileSlug] = useState("");
  const [slugSource, setSlugSource] = useState<"name" | "nickname">("name");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const myMemberProfile = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const trpcUtils = api.useUtils();

  const changeMyPassword = api.familyMember.changeMyPassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
      setFormSuccess("Password updated successfully.");
    },
    onError: (error) => {
      setFormSuccess(null);
      setFormError(error.message);
    },
  });

  const updateMyProfile = api.familyMember.updateMemberProfile.useMutation();

  useEffect(() => {
    if (!myMemberProfile.data) {
      return;
    }

    const nextName = myMemberProfile.data.name;
    const nextNickname = myMemberProfile.data.nickname ?? "";
    const nextSlug = myMemberProfile.data.slug;

    setProfileName(nextName);
    setProfileNickname(nextNickname);
    setSlugSource(resolveInitialSlugSource(nextSlug, nextName, nextNickname));
    setProfileSlug(nextSlug);
    setProfileImageUrl(myMemberProfile.data.image ?? "");
    setProfileError(null);
  }, [myMemberProfile.data]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
      }
    };
  }, [selectedAvatarPreviewUrl]);

  const isSubmitting = changeMyPassword.isPending;
  const avatarPreviewUrl = selectedAvatarPreviewUrl ?? profileImageUrl;
  const profilePreviewName = profileName.trim().length > 0 ? profileName : (myMemberProfile.data?.name ?? "Member");
  const profileInitials = useMemo(() => getInitials(profilePreviewName), [profilePreviewName]);

  function handleAvatarSelected(file: File | null) {
    if (!file) {
      return;
    }

    setProfileError(null);
    setProfileSuccess(null);

    if (!ACCEPTED_AVATAR_MIME_TYPES.has(file.type)) {
      setProfileError("Please select a supported image format (jpg, png, webp, heic, heif).");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setProfileError("Avatar image exceeds the 15MB size limit.");
      return;
    }

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    setSelectedAvatarFile(file);
    setSelectedAvatarPreviewUrl(URL.createObjectURL(file));
    setUploadProgress(0);
  }

  function handleRemoveAvatar() {
    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    setSelectedAvatarFile(null);
    setSelectedAvatarPreviewUrl(null);
    setUploadProgress(0);
    setProfileImageUrl("");
    setProfileSuccess(null);
  }

  function handleProfileNameChange(value: string) {
    setProfileName(value);
    setProfileSlug(getSlugFromSource(slugSource, value, profileNickname));
  }

  function handleProfileNicknameChange(value: string) {
    setProfileNickname(value);
    setProfileSlug(getSlugFromSource(slugSource, profileName, value));
  }

  function handleSlugSourceChange(source: "name" | "nickname") {
    setSlugSource(source);
    setProfileSlug(getSlugFromSource(source, profileName, profileNickname));
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isProfileSaving) {
      return;
    }

    if (!familyId || !myMemberProfile.data?.id) {
      setProfileError("No active family context found for this account.");
      return;
    }

    const normalizedName = profileName.trim();
    const normalizedNickname = profileNickname.trim();
    const normalizedSlug = profileSlug.trim();

    if (normalizedName.length === 0) {
      setProfileError("Name is required.");
      return;
    }

    setProfileError(null);
    setProfileSuccess(null);
    setIsProfileSaving(true);

    try {
      let nextAvatarUrl = profileImageUrl.trim();

      if (selectedAvatarFile) {
        const intentsResponse = await fetch("/api/uploads/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            familyId,
            uploadFor: "avatar",
            memberId: myMemberProfile.data.id,
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

        nextAvatarUrl = avatarIntent.readUrl;
      }

      await updateMyProfile.mutateAsync({
        familyId,
        memberId: myMemberProfile.data.id,
        name: normalizedName,
        nickname: normalizedNickname.length > 0 ? normalizedNickname : null,
        slug: normalizedSlug,
        image: nextAvatarUrl.length > 0 ? nextAvatarUrl : null,
      });

      await Promise.all([
        trpcUtils.familyMember.getCurrentUserMemberProfile.invalidate(),
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ]);

      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
      }

      setSelectedAvatarFile(null);
      setSelectedAvatarPreviewUrl(null);
      setUploadProgress(0);
      setProfileImageUrl(nextAvatarUrl);
      setProfileSuccess("Profile settings updated.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!familyId) {
      setFormError("No active family context found for this account.");
      return;
    }

    if (currentPassword.trim().length === 0) {
      setFormError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirm password must match.");
      return;
    }

    await changeMyPassword.mutateAsync({
      familyId,
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-semibold text-xl tracking-tight">Account</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account preferences and security settings.
        </p>
      </header>

      {managementContext.isLoading ? (
        <AccountContextSkeleton />
      ) : null}

      {!managementContext.isLoading && !familyId ? (
        <Alert>
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>No active family found</AlertTitle>
          <AlertDescription>
            Join a family or switch family context before changing your password.
          </AlertDescription>
        </Alert>
      ) : null}

      <details className="group rounded-3xl border bg-card p-5 shadow-sm sm:p-6" open>
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
              Profile
            </h2>
          </div>
          <ArrowRight
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground text-xs">
            Set your profile picture, name, nickname, and slug.
          </p>

          {myMemberProfile.isLoading ? (
            <ProfileSettingsSkeleton />
          ) : myMemberProfile.data ? (
            <form onSubmit={handleProfileSubmit} className="space-y-4" noValidate>
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
                <Avatar className="size-14 shrink-0 border">
                  <AvatarImage src={avatarPreviewUrl || undefined} alt={profilePreviewName} />
                  <AvatarFallback className="text-sm font-semibold text-foreground">{profileInitials}</AvatarFallback>
                </Avatar>

                {/* <div className="min-w-0">
                  <p className="font-medium text-sm">Live preview</p>
                  <p className="truncate text-muted-foreground text-xs">{profilePreviewName}</p>
                </div> */}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProfileSaving}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Choose image
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveAvatar}
                    disabled={isProfileSaving || (!avatarPreviewUrl && !selectedAvatarFile)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {selectedAvatarFile ? (
                <p className="text-muted-foreground text-xs">Selected image: {selectedAvatarFile.name}</p>
              ) : null}

              {isProfileSaving && uploadProgress > 0 ? (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-muted-foreground text-xs">Uploading avatar: {uploadProgress}%</p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="profile-full-name" className="text-sm font-medium">
                  Full name
                </label>
                <Input
                  id="profile-full-name"
                  value={profileName}
                  onChange={(event) => handleProfileNameChange(event.target.value)}
                  placeholder="Enter full name"
                  disabled={isProfileSaving}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-nickname" className="text-sm font-medium">
                  Nickname
                </label>
                <Input
                  id="profile-nickname"
                  value={profileNickname}
                  onChange={(event) => handleProfileNicknameChange(event.target.value)}
                  placeholder="Enter nickname (optional)"
                  disabled={isProfileSaving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-slug" className="text-sm font-medium">
                  Profile slug
                </label>
                <div className="relative">
                  <Input
                    id="profile-slug"
                    value={profileSlug}
                    placeholder="your-profile-slug"
                    readOnly
                    className="pr-44"
                  />
                  <div className="absolute top-1/2 right-1.5 inline-flex -translate-y-1/2 rounded-xl border bg-muted/40 p-0.5">
                    <button
                      type="button"
                      className={`rounded-xl px-2 py-1 text-[11px] font-medium transition ${
                        slugSource === "name"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleSlugSourceChange("name")}
                      disabled={isProfileSaving}
                    >
                      Full name
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl px-2 py-1 text-[11px] font-medium transition ${
                        slugSource === "nickname"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleSlugSourceChange("nickname")}
                      disabled={isProfileSaving}
                    >
                      Nickname
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Automatically generated from the selected source.
                </p>
              </div>

              {profileError ? (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {profileError}
                </p>
              ) : null}

              {profileSuccess ? (
                <p role="status" aria-live="polite" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {profileSuccess}
                </p>
              ) : null}

              <div className="pt-1">
                <Button type="submit" disabled={isProfileSaving || !familyId || !myMemberProfile.data.id}>
                  {isProfileSaving ? (
                    <>
                      <Loader className="size-4 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    "Save profile settings"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-muted-foreground text-xs">
              We couldn&apos;t find your member profile in the current family.
            </p>
          )}
        </div>
      </details>

      <details className="group rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <div className="flex items-center gap-2">
            <Security className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
              Password security
            </h2>
          </div>
          <ArrowRight
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground text-xs">
            You must enter your current password before setting a new one.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm new password
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            {formError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}

            {formSuccess ? (
              <p role="status" aria-live="polite" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                {formSuccess}
              </p>
            ) : null}

            <div className="pt-1">
              <Button type="submit" disabled={isSubmitting || !familyId}>
                {isSubmitting ? (
                  <>
                    <Loader className="size-4 animate-spin" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </details>
    </div>
  );
}

function AccountContextSkeleton() {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-5 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-44 rounded-full" />
          <Skeleton className="h-3 w-64 max-w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ProfileSettingsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
        <Skeleton className="size-14 shrink-0 rounded-full border" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-2.5 w-52 rounded-full" />
      </div>

      <Skeleton className="h-9 w-40 rounded-full" />
    </div>
  );
}
