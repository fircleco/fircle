"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { CalendarDays, Camera, User, X } from "~/components/ui/icons";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";

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
  dateOfBirth?: Date;
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
    dateOfBirth: undefined,
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      name: member.name,
      avatarUrl: member.avatarUrl ?? "",
      dateOfBirth: undefined,
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
                <Avatar className="size-14 shrink-0 border">
                  <AvatarImage src={form.avatarUrl} alt={form.name || member.name} />
                  <AvatarFallback className="text-sm font-semibold text-foreground">
                    {previewInitials}
                  </AvatarFallback>
                </Avatar>

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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        data-empty={!form.dateOfBirth}
                        className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
                      >
                        <CalendarDays className="size-4" aria-hidden="true" />
                        {form.dateOfBirth ? format(form.dateOfBirth, "PPP") : <span>Select date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.dateOfBirth}
                        onSelect={(date) => setForm((prev) => ({ ...prev, dateOfBirth: date }))}
                        captionLayout="dropdown"
                        defaultMonth={form.dateOfBirth ?? new Date(2000, 0, 1)}
                      />
                    </PopoverContent>
                  </Popover>
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
