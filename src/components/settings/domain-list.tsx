"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Button } from "~/components/ui/button";
import { DomainVerification } from "~/components/settings/domain-verification";
import { AlertCircle, CheckCircle2, Delete } from "~/components/ui/icons";
import { api } from "~/trpc/react";

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

  if (domainsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading domains...</div>;
  }

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
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  Primary
                </span>
              )}
              {domain.verifiedAt ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="size-3" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="size-3" />
                  Pending verification
                </span>
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

      {deleteConfirm && domainToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="font-semibold text-base mb-2">Remove Domain</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to remove this domain? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirm(false);
                  setDomainToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveDomain}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
