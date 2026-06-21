"use client";

import { useMemo, useState } from "react";

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

interface VerificationErrorState {
  type: "retryable" | "terminal";
  message: string;
  hint: string;
}

function classifyVerificationError(errorMessage: string): VerificationErrorState {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes("not found yet") ||
    normalized.includes("timed out") ||
    normalized.includes("could not be reached")
  ) {
    return {
      type: "retryable",
      message: errorMessage,
      hint: "This usually means DNS propagation or endpoint availability is still in progress. You can retry after a short wait.",
    };
  }

  if (
    normalized.includes("does not match") ||
    normalized.includes("invalid")
  ) {
    return {
      type: "terminal",
      message: errorMessage,
      hint: "Your verification record is reachable but incorrect. Update the challenge value and retry.",
    };
  }

  return {
    type: "terminal",
    message: errorMessage,
    hint: "Please review your DNS/HTTP setup and try again.",
  };
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
  const [error, setError] = useState<VerificationErrorState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verificationTokenQuery = api.domain.getVerificationToken.useQuery({
    familyId,
    domainId,
  });

  const verifyDomainMutation = api.domain.verifyDomain.useMutation();

  const dnsRecord = verificationTokenQuery.data?.dnsRecord;
  const httpChallenge = verificationTokenQuery.data?.httpChallenge;

  const selectedMethodHint = useMemo(() => {
    if (method === "dns") {
      return "Use this after adding the TXT record and waiting for propagation.";
    }

    return "Use this after serving the token from the HTTP challenge endpoint.";
  }, [method]);

  const handleCopyToken = (text: string) => {
    if (!text) {
      return;
    }

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await verifyDomainMutation.mutateAsync({
        familyId,
        domainId,
        verificationMethod: method,
      });

      onSuccess();
      setSuccessMessage("Domain verified successfully. Closing dialog...");
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(classifyVerificationError(message));
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verify Domain: {domain}</DialogTitle>
          <DialogDescription>
            Complete ownership verification by configuring DNS or HTTP challenge proof, then run verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">DNS Verification (Recommended)</h3>
            <p className="text-xs text-muted-foreground">
              Add a TXT record to your domain&apos;s DNS settings.
            </p>

            <div className="rounded bg-muted/30 p-3 font-mono text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Name:</div>
                  <div className="select-all font-semibold">{dnsRecord?.name}</div>
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
                <div className="mb-1 text-xs text-muted-foreground">Type:</div>
                <div className="font-semibold">{dnsRecord?.type}</div>
              </div>

              <div className="border-t pt-2">
                <div className="mb-1 text-xs text-muted-foreground">Value:</div>
                <div className="select-all break-all font-semibold">{dnsRecord?.value}</div>
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
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">HTTP Verification</h3>
            <p className="text-xs text-muted-foreground">
              Serve the verification token from the challenge endpoint shown below.
            </p>

            <div className="rounded bg-muted/30 p-3 font-mono text-xs">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Method:</div>
                <div className="font-semibold">{httpChallenge?.method}</div>
              </div>

              <div className="mt-2 border-t pt-2">
                <div className="mb-1 text-xs text-muted-foreground">URL:</div>
                <div className="select-all break-all font-semibold">{httpChallenge?.url}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToken(httpChallenge?.url ?? "")}
                  className="mt-1"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy URL
                </Button>
              </div>

              <div className="mt-2 border-t pt-2">
                <div className="mb-1 text-xs text-muted-foreground">Expected Response Body:</div>
                <Input readOnly value={httpChallenge?.expectedBody ?? ""} className="h-8 text-xs" />
              </div>
            </div>
          </div>

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
                  <span className="text-sm">HTTP Endpoint</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{selectedMethodHint}</p>
            </div>

            {error && (
              <div
                className={
                  error.type === "retryable"
                    ? "rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
                    : "rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                }
              >
                <p className="font-semibold">{error.type === "retryable" ? "Verification pending" : "Verification failed"}</p>
                <p className="mt-1">{error.message}</p>
                <p className="mt-1">{error.hint}</p>
              </div>
            )}

            {successMessage && (
              <div className="rounded border border-green-300 bg-green-50 p-3 text-xs text-green-800">
                {successMessage}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || verifyDomainMutation.isPending}
              >
                {isSubmitting || verifyDomainMutation.isPending ? "Running verification..." : "Run Verification Check"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
