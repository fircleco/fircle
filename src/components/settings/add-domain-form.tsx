"use client";

import { useState } from "react";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

const addDomainFormSchema = z.object({
  domain: z
    .string()
    .min(3, "Domain must be at least 3 characters")
    .max(255, "Domain is too long")
    .toLowerCase()
    .refine(
      (val) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(val),
      "Invalid domain format",
    ),
});

interface AddDomainFormProps {
  familyId: string;
  onSuccess?: () => void;
}

export function AddDomainForm({ familyId, onSuccess }: AddDomainFormProps) {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addDomainMutation = api.domain.addDomain.useMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate input
      const result = addDomainFormSchema.safeParse({ domain });
      if (!result.success) {
        const firstError = result.error.errors[0];
        if (firstError) {
          setError(firstError.message);
        }
        setIsSubmitting(false);
        return;
      }

      await addDomainMutation.mutateAsync({
        familyId,
        domain: result.data.domain,
      });

      setDomain("");
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add domain";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="domain" className="text-sm font-medium">
          Domain Name
        </label>
        <Input
          id="domain"
          placeholder="example.com"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setError(null);
          }}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Enter the domain you want to use (e.g., example.com or subdomain.example.com)
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || addDomainMutation.isPending}>
          {isSubmitting || addDomainMutation.isPending ? "Adding..." : "Add Domain"}
        </Button>
      </div>
    </form>
  );
}
