"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Copy, Check } from "~/components/ui/icons";
import { api } from "~/trpc/react";

interface DomainVerificationProps {
  familyId: string;
  domainId: string;
  domain: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DomainVerification({
  familyId,
  domainId,
  domain,
  onClose,
  onSuccess,
}: DomainVerificationProps) {
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<"dns" | "http">("dns");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verificationTokenQuery = api.domain.getVerificationToken.useQuery({
    familyId,
    domainId,
  });

  const verifyDomainMutation = api.domain.verifyDomain.useMutation();

  const handleCopyToken = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await verifyDomainMutation.mutateAsync({
        familyId,
        domainId,
        verificationMethod: method,
        token: token.trim(),
      });

      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (verificationTokenQuery.isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Domain</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">Loading verification details...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (verificationTokenQuery.isError) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-destructive">Failed to load verification details</div>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const dnsRecord = verificationTokenQuery.data?.dnsRecord;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verify Domain: {domain}</DialogTitle>
          <DialogDescription>
            Complete ownership verification by adding a DNS record or HTTP endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* DNS Method */}
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold text-sm">DNS Verification (Recommended)</h3>
            <p className="text-xs text-muted-foreground">
              Add a TXT record to your domain&apos;s DNS settings.
            </p>

            <div className="space-y-2 bg-muted/30 p-3 rounded text-xs font-mono">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Name:</div>
                  <div className="font-semibold select-all">{dnsRecord?.name}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToken(dnsRecord?.name ?? "")}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>

              <div className="border-t pt-2">
                <div className="text-muted-foreground text-xs mb-1">Type:</div>
                <div className="font-semibold">{dnsRecord?.type}</div>
              </div>

              <div className="border-t pt-2">
                <div className="text-muted-foreground text-xs mb-1">Value:</div>
                <div className="font-semibold select-all break-all">{dnsRecord?.value}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToken(dnsRecord?.value ?? "")}
                  className="mt-1"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy Value
                </Button>
              </div>
            </div>

            <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              <li>Log in to your domain registrar or DNS provider</li>
              <li>Find the DNS records section for your domain</li>
              <li>Add a new TXT record with the details above</li>
              <li>Wait 5-10 minutes for DNS to propagate</li>
            </ol>
          </div>

          {/* Verification Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Method</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="dns"
                    checked={method === "dns"}
                    onChange={(e) => setMethod(e.target.value as "dns" | "http")}
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">DNS TXT Record</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="http"
                    checked={method === "http"}
                    onChange={(e) => setMethod(e.target.value as "dns" | "http")}
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">HTTP Token</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Verification Token
              </label>
              <Input
                id="token"
                placeholder="Enter the verification token"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Enter the token from your DNS record or HTTP endpoint
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || verifyDomainMutation.isPending}
              >
                {isSubmitting || verifyDomainMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
