import { describe, expect, it } from "vitest";

import {
  filterMentionMembers,
  getActiveMentionQuery,
  insertMentionAtQuery,
  normalizeMentionsForSubmit,
  reconcileMentionsOnTextChange,
  type MentionDraft,
} from "~/components/feed/mention-helpers";

describe("getActiveMentionQuery", () => {
  it("returns active query for trailing @token at caret", () => {
    const text = "Hello @Par";
    const result = getActiveMentionQuery(text, text.length);

    expect(result).toEqual({
      tokenStart: 6,
      tokenEnd: 10,
      query: "Par",
    });
  });

  it("returns null when token includes whitespace", () => {
    const text = "Hello @Parent One";
    const result = getActiveMentionQuery(text, text.length);

    expect(result).toBeNull();
  });
});

describe("reconcileMentionsOnTextChange", () => {
  it("shifts mention ranges after insertion before the mention", () => {
    const previousText = "Hello @Parent";
    const nextText = "Hey! Hello @Parent";
    const mentions: MentionDraft[] = [
      {
        memberId: "member-1",
        start: 6,
        end: 13,
      },
    ];

    const nextMentions = reconcileMentionsOnTextChange(previousText, nextText, mentions);

    expect(nextMentions).toEqual([
      {
        memberId: "member-1",
        start: 11,
        end: 18,
      },
    ]);
  });

  it("drops mention when edit intersects existing mention range", () => {
    const previousText = "Hello @Parent";
    const nextText = "Hello @Par";
    const mentions: MentionDraft[] = [
      {
        memberId: "member-1",
        start: 6,
        end: 13,
      },
    ];

    const nextMentions = reconcileMentionsOnTextChange(previousText, nextText, mentions);

    expect(nextMentions).toEqual([]);
  });
});

describe("insertMentionAtQuery", () => {
  it("replaces active query token and appends trailing space when needed", () => {
    const inserted = insertMentionAtQuery({
      text: "Hi @Pa there",
      mentions: [],
      activeQuery: {
        tokenStart: 3,
        tokenEnd: 6,
        query: "Pa",
      },
      member: {
        id: "member-1",
        name: "Parent One",
        avatarUrl: "",
      },
    });

    expect(inserted.text).toBe("Hi @Parent One there");
    expect(inserted.mentions).toEqual([
      {
        kind: "MEMBER",
        memberId: "member-1",
        start: 3,
        end: 14,
      },
    ]);
    expect(inserted.caret).toBe(14);
  });

  it("supports inserting special ALL mentions", () => {
    const inserted = insertMentionAtQuery({
      text: "Ping @al team",
      mentions: [],
      activeQuery: {
        tokenStart: 5,
        tokenEnd: 8,
        query: "al",
      },
      member: {
        kind: "ALL",
        id: "all",
        name: "all",
        avatarUrl: "",
      },
    });

    expect(inserted.text).toBe("Ping @all team");
    expect(inserted.mentions).toEqual([
      {
        kind: "ALL",
        start: 5,
        end: 9,
      },
    ]);
    expect(inserted.caret).toBe(9);
  });
});

describe("normalizeMentionsForSubmit", () => {
  it("trims text and shifts mention ranges from leading whitespace", () => {
    const normalized = normalizeMentionsForSubmit({
      text: "   @Parent One says hi   ",
      mentions: [
        {
          memberId: "member-1",
          start: 3,
          end: 14,
        },
      ],
    });

    expect(normalized.text).toBe("@Parent One says hi");
    expect(normalized.mentions).toEqual([
      {
        memberId: "member-1",
        start: 0,
        end: 11,
      },
    ]);
  });
});

describe("filterMentionMembers", () => {
  const members = [
    { id: "m1", name: "Parent One", avatarUrl: "" },
    { id: "m2", name: "Child One", avatarUrl: "" },
    { id: "m3", name: "Grand Parent", avatarUrl: "" },
  ];

  it("returns members that match active query", () => {
    const result = filterMentionMembers({
      members,
      activeQuery: {
        tokenStart: 0,
        tokenEnd: 3,
        query: "par",
      },
    });

    expect(result.map((member) => member.name)).toEqual(["Parent One", "Grand Parent"]);
  });

  it("returns empty array when there is no active query", () => {
    const result = filterMentionMembers({
      members,
      activeQuery: null,
    });

    expect(result).toEqual([]);
  });
});
