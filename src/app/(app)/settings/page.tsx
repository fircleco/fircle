"use client";

import { useState } from "react";
import { Camera, TriangleAlert } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { familySettings } from "~/lib/mocks/family-settings";
import { cn } from "~/lib/utils";

export default function FamilySettingsPage() {
  const [familyName, setFamilyName] = useState(familySettings.name);
  const [invitePolicy, setInvitePolicy] = useState(familySettings.invitePolicy);
  const [isSaving, setIsSaving] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1200);
  }

  return (
    <div className="space-y-8">
      <h2 className="font-semibold text-xl tracking-tight">Family Settings</h2>

      {/* Family Identity */}
      <section className="space-y-5 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">Family Identity</h3>

        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted text-muted-foreground">
            {familySettings.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={familySettings.avatarUrl}
                alt="Family avatar"
                className="size-full rounded-full object-cover"
              />
            ) : (
              <Camera className="size-7" />
            )}
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Change photo
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="family-name" className="text-sm font-medium">
              Family name
            </label>
            <Input
              id="family-name"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="e.g. The Walker Family"
              className="max-w-sm"
            />
          </div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </section>

      {/* Invite Policy */}
      <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
        <div className="space-y-0.5">
          <h3 className="font-medium text-base">Invite Policy</h3>
          <p className="text-muted-foreground text-xs">
            Controls which members can generate invite links for new family members.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Who can send invites?</legend>
          <p className="text-sm font-medium">Who can send invites?</p>
          {(
            [
              { value: "admin_only", label: "Admins only" },
              { value: "any_member", label: "Any member" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                invitePolicy === option.value
                  ? "border-primary/60 bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="invite-policy"
                value={option.value}
                checked={invitePolicy === option.value}
                onChange={() => setInvitePolicy(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <Button
          type="button"
          disabled={isSaving}
          onClick={() => {
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 1200);
          }}
        >
          {isSaving ? "Saving…" : "Save Changes"}
        </Button>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-0.5">
            <h3 className="font-medium text-base text-destructive">Danger Zone</h3>
            <p className="text-muted-foreground text-xs">
              Destructive actions cannot be undone. Contact the family owner to proceed.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled
          title="Contact family owner to perform this action."
          className="border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Reset family data
        </Button>
      </section>
    </div>
  );
}
