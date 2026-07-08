import { describe, expect, it } from "vitest";

import { formatFamilyDisplayName, normalizeFamilyNameInput } from "~/lib/family-name";

describe("normalizeFamilyNameInput", () => {
  it("removes leading article and trailing family suffix", () => {
    expect(normalizeFamilyNameInput("The Walker Family")).toBe("Walker");
    expect(normalizeFamilyNameInput("walker family")).toBe("walker");
  });

  it("preserves internal words while collapsing whitespace", () => {
    expect(normalizeFamilyNameInput("  De   la   Cruz  ")).toBe("De la Cruz");
  });
});

describe("formatFamilyDisplayName", () => {
  it("formats normalized family names with article and suffix by default", () => {
    expect(formatFamilyDisplayName("Walker")).toBe("The Walker Family");
    expect(formatFamilyDisplayName("The Walker Family")).toBe("The Walker Family");
  });

  it("supports formatting options", () => {
    expect(formatFamilyDisplayName("Walker", { includeArticle: false })).toBe("Walker Family");
    expect(formatFamilyDisplayName("Walker", { includeSuffix: false })).toBe("The Walker");
  });
});
