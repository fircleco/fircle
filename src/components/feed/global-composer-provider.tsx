"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { ComposerOpenMode } from "./composer-entry";
import { PostComposerDialog } from "./post-composer-dialog";
import { api } from "~/trpc/react";

type GlobalComposerContextValue = {
  openComposer: (mode?: ComposerOpenMode) => void;
};

const GlobalComposerContext = createContext<GlobalComposerContextValue | null>(null);

export function GlobalComposerProvider({ children }: { children: React.ReactNode }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerOpenMode | undefined>(undefined);

  const managementContext = api.family.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const canUseAllMention =
    managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const contextValue = useMemo<GlobalComposerContextValue>(
    () => ({
      openComposer: (mode?: ComposerOpenMode) => {
        setComposerMode(mode);
        setComposerOpen(true);
      },
    }),
    [],
  );

  return (
    <GlobalComposerContext.Provider value={contextValue}>
      {children}
      <PostComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        familyId={familyId}
        allowAllMention={canUseAllMention}
        initialMode={composerMode}
      />
    </GlobalComposerContext.Provider>
  );
}

export function useGlobalComposer() {
  const context = useContext(GlobalComposerContext);
  if (!context) {
    throw new Error("useGlobalComposer must be used within GlobalComposerProvider");
  }
  return context;
}