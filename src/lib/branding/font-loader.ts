"use client";

import { useEffect } from "react";

import { buildLogotypeFontStylesheetUrl } from "~/lib/branding/logotype-fonts";

type StylesheetEntry = {
  element: HTMLLinkElement;
  count: number;
};

const PRECONNECT_SELECTOR = "link[data-logotype-font-preconnect='1']";
const STYLESHEET_ATTR = "data-logotype-font-stylesheet";

const stylesheetRegistry = new Map<string, StylesheetEntry>();
let preconnectRefCount = 0;

function ensurePreconnect(): () => void {
  let preconnectLink = document.head.querySelector<HTMLLinkElement>(PRECONNECT_SELECTOR);

  if (!preconnectLink) {
    preconnectLink = document.createElement("link");
    preconnectLink.rel = "preconnect";
    preconnectLink.href = "https://api.fonts.coollabs.io";
    preconnectLink.crossOrigin = "anonymous";
    preconnectLink.dataset.logotypeFontPreconnect = "1";
    document.head.appendChild(preconnectLink);
  }

  preconnectRefCount += 1;

  return () => {
    preconnectRefCount = Math.max(0, preconnectRefCount - 1);

    if (preconnectRefCount > 0) {
      return;
    }

    const activeLink = document.head.querySelector<HTMLLinkElement>(PRECONNECT_SELECTOR);
    activeLink?.remove();
  };
}

function acquireStylesheet(href: string): () => void {
  const existingEntry = stylesheetRegistry.get(href);

  if (existingEntry) {
    existingEntry.count += 1;

    return () => {
      const entry = stylesheetRegistry.get(href);
      if (!entry) {
        return;
      }

      entry.count -= 1;
      if (entry.count > 0) {
        return;
      }

      entry.element.remove();
      stylesheetRegistry.delete(href);
    };
  }

  const stylesheetLink = document.createElement("link");
  stylesheetLink.rel = "stylesheet";
  stylesheetLink.href = href;
  stylesheetLink.setAttribute(STYLESHEET_ATTR, "1");
  document.head.appendChild(stylesheetLink);

  stylesheetRegistry.set(href, {
    element: stylesheetLink,
    count: 1,
  });

  return () => {
    const entry = stylesheetRegistry.get(href);
    if (!entry) {
      return;
    }

    entry.count -= 1;
    if (entry.count > 0) {
      return;
    }

    entry.element.remove();
    stylesheetRegistry.delete(href);
  };
}

export function useLogotypeFontStylesheet(fontName: string | null): void {
  useEffect(() => {
    if (!fontName) {
      return;
    }

    const href = buildLogotypeFontStylesheetUrl(fontName);
    const releasePreconnect = ensurePreconnect();
    const releaseStylesheet = acquireStylesheet(href);

    return () => {
      releaseStylesheet();
      releasePreconnect();
    };
  }, [fontName]);
}
