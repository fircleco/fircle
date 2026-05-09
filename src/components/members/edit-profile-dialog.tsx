"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CalendarDays, Camera, User, X } from "~/components/ui/icons";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

type EditProfileDialogProps = {
  member: FamilyMemberProfile;
  triggerText?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
};

type EditProfileFormState = {
  name: string;
  avatarUrl: string;
  relationship: string;
  location: string;
  dateOfBirth: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function EditProfileDialog({
  member,
  triggerText = "Edit profile",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditProfileFormState>({
    name: member.name,
    avatarUrl: member.avatarUrl ?? "",
    relationship: member.relationship,
    location: member.location ?? "",
    dateOfBirth: "",
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      name: member.name,
      avatarUrl: member.avatarUrl ?? "",
      relationship: member.relationship,
      location: member.location ?? "",
      dateOfBirth: "",
    });
  }, [member, open]);

  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isSaving, open]);

  const previewInitials = useMemo(() => getInitials(form.name || member.name), [form.name, member.name]);

  const closeDialog = () => {
    if (isSaving) return;
    setOpen(false);
  };

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);

    window.setTimeout(() => {
      setIsSaving(false);
      setOpen(false);
    }, 500);
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerText}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-border/80 bg-card p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-xl tracking-tight">Edit profile</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Update basic profile details like name, picture, and personal info.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeDialog}
                aria-label="Close edit profile dialog"
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
                <div
                  aria-hidden="true"
                  className={cn(
                    "grid size-14 shrink-0 place-items-center rounded-full border text-sm font-semibold text-foreground",
                    form.avatarUrl ? "bg-cover bg-center text-transparent" : "bg-muted",
                  )}
                  style={
                    form.avatarUrl
                      ? {
                          backgroundImage: `url(${form.avatarUrl})`,
                        }
                      : undefined
                  }
                >
                  {previewInitials}
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-sm">Live preview</p>
                  <p className="truncate text-muted-foreground text-xs">{form.name || member.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                    <User className="size-3.5" aria-hidden="true" />
                    Full name
                  </span>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter full name"
                  />
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    Date of birth
                  </span>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground text-xs">Relationship</span>
                  <Input
                    value={form.relationship}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, relationship: event.target.value }))
                    }
                    placeholder="Parent, Child, Cousin..."
                  />
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground text-xs">Location</span>
                  <Input
                    value={form.location}
                    onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="City or region"
                  />
                </label>
              </div>

              <label className="space-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Camera className="size-3.5" aria-hidden="true" />
                  Profile picture URL
                </span>
                <Input
                  value={form.avatarUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </label>

              <p className="text-muted-foreground text-xs">
                Demo mode: changes in this popup are for preview only and are not saved permanently yet.
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving || form.name.trim().length === 0}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
