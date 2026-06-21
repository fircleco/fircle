"use client";

import { useState } from "react";

import { DomainList } from "~/components/settings/domain-list";
import { AddDomainForm } from "~/components/settings/add-domain-form";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Plus } from "~/components/ui/icons";
import { api } from "~/trpc/react";

export default function DomainSettingsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const utils = api.useUtils();

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const handleDomainAdded = () => {
    setIsAddDialogOpen(false);
    if (familyId) {
      void utils.domain.listDomains.invalidate({ familyId });
    }
  };

  const handleDomainUpdated = () => {
    if (familyId) {
      void utils.domain.listDomains.invalidate({ familyId });
    }
  };

  if (!familyId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold">Domain Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage custom domains and configure DNS verification for your family instance.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Your Domains</h3>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Domain</DialogTitle>
                <DialogDescription>
                  Add a new custom domain for your family instance. You&apos;ll need to verify ownership by updating DNS records.
                </DialogDescription>
              </DialogHeader>
              <AddDomainForm
                familyId={familyId}
                onSuccess={handleDomainAdded}
              />
            </DialogContent>
          </Dialog>
        </div>

        <DomainList
          familyId={familyId}
          onUpdate={handleDomainUpdated}
        />
      </div>
    </div>
  );
}
