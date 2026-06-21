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
  const [copiedField, setCopiedField] = useState<string | null>(null);
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

  const handleCopyToken = (field: string, text: string) => {
    if (!text) {
      return;
    }

    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
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
      <DialogContent className="max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Verify Domain: {domain}</DialogTitle>
          <DialogDescription>
            Complete ownership verification by configuring DNS or HTTP challenge proof, then run verification.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium">Verification Method</label>
            <div className="flex w-full min-w-0 gap-2 rounded-lg border border-input bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setMethod("dns")}
                disabled={isSubmitting}
                className={`min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  method === "dns"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                DNS TXT Record
              </button>
              <button
                type="button"
                onClick={() => setMethod("http")}
                disabled={isSubmitting}
                className={`min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  method === "http"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                HTTP Endpoint
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{selectedMethodHint}</p>
          </div>

          {method === "dns" && (
            <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">DNS Setup Instructions</h3>
              <p className="text-xs text-muted-foreground">
                Add this TXT record to your domain&apos;s DNS settings.
              </p>

              <div className="min-w-0 space-y-2 rounded bg-muted/40 p-3 font-mono text-xs">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Name:</div>
                  <div className="relative min-w-0 max-w-full">
                    <div className="max-w-full overflow-hidden rounded-md border bg-background/80 pr-12">
                      <div className="overflow-x-auto px-3 py-2 font-semibold whitespace-nowrap">
                        <div className="select-all inline-block min-w-full">{dnsRecord?.name}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToken("dns-name", dnsRecord?.name ?? "")}
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    >
                      {copiedField === "dns-name" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Type:</div>
                  <div className="font-semibold">{dnsRecord?.type}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Value:</div>
                  <div className="relative min-w-0 max-w-full">
                    <div className="max-w-full overflow-hidden rounded-md border bg-background/80 pr-12">
                      <div className="overflow-x-auto scrollbar px-3 py-2 font-semibold whitespace-nowrap">
                        <div className="select-all inline-block min-w-full">{dnsRecord?.value}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToken("dns-value", dnsRecord?.value ?? "")}
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    >
                      {copiedField === "dns-value" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {method === "http" && (
            <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">HTTP Setup Instructions</h3>
              <p className="text-xs text-muted-foreground">
                Serve the verification token from this endpoint on your domain.
              </p>

              <div className="min-w-0 space-y-2 rounded bg-muted/40 p-3 font-mono text-xs">
                <div>
                  <div className="text-xs text-muted-foreground">Method:</div>
                  <div className="font-semibold">{httpChallenge?.method}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">URL:</div>
                  <div className="relative min-w-0 max-w-full">
                    <div className="max-w-full overflow-hidden rounded-md border bg-background/80 pr-12">
                      <div className="overflow-x-auto scrollbar px-3 py-2 font-semibold whitespace-nowrap">
                        <div className="select-all inline-block min-w-full">{httpChallenge?.url}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToken("http-url", httpChallenge?.url ?? "")}
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    >
                      {copiedField === "http-url" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Expected Response Body:</div>
                  <div className="relative">
                    <Input
                      readOnly
                      value={httpChallenge?.expectedBody ?? ""}
                      className="h-10 pr-12 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToken("http-body", httpChallenge?.expectedBody ?? "")}
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    >
                      {copiedField === "http-body" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
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

