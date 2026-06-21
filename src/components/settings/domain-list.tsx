"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DomainVerification } from "~/components/settings/domain-verification";
import { AlertCircle, CheckCircle2, Delete } from "~/components/ui/icons";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

interface DomainListProps {
  familyId: string;
  onUpdate?: () => void;
}

export function DomainList({ familyId, onUpdate }: DomainListProps) {
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  const domainsQuery = api.domain.listDomains.useQuery({ familyId });
  const setPrimaryMutation = api.domain.setPrimaryDomain.useMutation();
  const removeDomainMutation = api.domain.removeDomain.useMutation();

  if (domainsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start justify-between rounded-lg border p-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32 rounded-full" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const handleSetPrimary = async (domainId: string) => {
    try {
      await setPrimaryMutation.mutateAsync({
        familyId,
        domainId,
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to set primary domain", error);
    }
  };

  const handleRemoveDomain = async () => {
    if (!domainToDelete) return;

    try {
      await removeDomainMutation.mutateAsync({
        familyId,
        domainId: domainToDelete,
      });

      setDomainToDelete(null);
      setDeleteConfirm(false);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to remove domain", error);
    }
  };

  if (domainsQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load domains. Please try again.
      </div>
    );
  }

  const domains = domainsQuery.data ?? [];

  if (domains.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No domains yet. Add your first domain to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {domains.map((domain) => (
        <div
          key={domain.id}
          className="flex items-start justify-between rounded-lg border p-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{domain.domain}</h4>
              {domain.isPrimary && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                  Primary
                </Badge>
              )}
              {domain.verifiedAt ? (
                <Badge variant="outline" className="gap-1 border-green-700 bg-green-700 text-white">
                  <CheckCircle2 className="size-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                  <AlertCircle className="size-3" />
                  Pending verification
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Added {format(new Date(domain.createdAt), "MMM d, yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!domain.verifiedAt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerifyingDomainId(domain.id)}
              >
                Verify
              </Button>
            )}

            {domain.verifiedAt && !domain.isPrimary && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSetPrimary(domain.id)}
                disabled={setPrimaryMutation.isPending}
              >
                Set Primary
              </Button>
            )}

            {!domain.isPrimary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDomainToDelete(domain.id);
                  setDeleteConfirm(true);
                }}
                disabled={removeDomainMutation.isPending}
              >
                <Delete className="size-4" />
              </Button>
            )}

            {verifyingDomainId === domain.id && (
              <DomainVerification
                familyId={familyId}
                domainId={domain.id}
                domain={domain.domain}
                onClose={() => setVerifyingDomainId(null)}
                onSuccess={() => {
                  setVerifyingDomainId(null);
                  onUpdate?.();
                }}
              />
            )}
          </div>
        </div>
      ))}

      <Dialog
        open={deleteConfirm && Boolean(domainToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm(false);
            setDomainToDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove Domain</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this domain? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirm(false);
                setDomainToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveDomain}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
