"use client";

import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Image } from "~/components/ui/icons";
import { api } from "~/trpc/react";

export default function GalleryPage() {
  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (managementContext.isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-full bg-muted" />
        </header>
        <div className="rounded-3xl border bg-card p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-4/5 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const familyName = managementContext.data?.family?.name;

  return (
    <section className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1 max-w-2xl mx-auto">
        <p className="text-sm font-medium text-muted-foreground">Memories</p>
        <h1 className="text-3xl font-semibold tracking-tight">Gallery</h1>
        <p className="text-sm text-muted-foreground">
          {familyName
            ? `${familyName} media moments will appear here soon.`
            : "Family media moments will appear here soon."}
        </p>
      </header>

      <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Image className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium">Gallery is getting ready</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            We are preparing your family media index and member galleries.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/">Back to feed</Link>
        </Button>
      </div>
    </section>
  );
}
