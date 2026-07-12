export type MentionDraft =
  | {
      kind?: "MEMBER";
      memberId: string;
      start: number;
      end: number;
    }
  | {
      kind: "ALL";
      start: number;
      end: number;
    };

export type MentionableMember = {
  kind?: "MEMBER" | "ALL";
  id: string;
  name: string;
  avatarUrl: string;
};

export type ActiveMentionQuery = {
  tokenStart: number;
  tokenEnd: number;
  query: string;
};

export type MentionPopoverAnchor = {
  left: number;
  top: number;
};

function isWhitespace(char: string) {
  return /\s/.test(char);
}

export function getActiveMentionQuery(text: string, caret: number): ActiveMentionQuery | null {
  if (caret < 0 || caret > text.length) {
    return null;
  }

  let segmentStart = caret;
  while (segmentStart > 0 && !isWhitespace(text[segmentStart - 1]!)) {
    segmentStart -= 1;
  }

  const segment = text.slice(segmentStart, caret);
  const atIndex = segment.lastIndexOf("@");
  if (atIndex === -1) {
    return null;
  }

  const tokenStart = segmentStart + atIndex;
  const query = text.slice(tokenStart + 1, caret);

  if (query.includes("@") || /\s/.test(query)) {
    return null;
  }

  return {
    tokenStart,
    tokenEnd: caret,
    query,
  };
}

export function reconcileMentionsOnTextChange(
  previousText: string,
  nextText: string,
  mentions: MentionDraft[],
): MentionDraft[] {
  if (mentions.length === 0) {
    return mentions;
  }

  let prefix = 0;
  const maxPrefix = Math.min(previousText.length, nextText.length);
  while (prefix < maxPrefix && previousText[prefix] === nextText[prefix]) {
    prefix += 1;
  }

  let prevSuffix = previousText.length;
  let nextSuffix = nextText.length;
  while (
    prevSuffix > prefix &&
    nextSuffix > prefix &&
    previousText[prevSuffix - 1] === nextText[nextSuffix - 1]
  ) {
    prevSuffix -= 1;
    nextSuffix -= 1;
  }

  const delta = nextText.length - previousText.length;

  const shifted = mentions
    .map((mention) => {
      if (mention.end <= prefix) {
        return mention;
      }

      if (mention.start >= prevSuffix) {
        return {
          ...mention,
          start: mention.start + delta,
          end: mention.end + delta,
        };
      }

      return null;
    })
    .filter((mention): mention is MentionDraft => mention !== null)
    .filter((mention) => mention.start >= 0 && mention.end <= nextText.length && mention.start < mention.end)
    .filter((mention) => nextText.slice(mention.start, mention.end).startsWith("@"));

  return sortAndDedupeMentions(shifted);
}

export function insertMentionAtQuery(input: {
  text: string;
  mentions: MentionDraft[];
  activeQuery: ActiveMentionQuery;
  member: MentionableMember;
}) {
  const mentionText = `@${input.member.name}`;
  const before = input.text.slice(0, input.activeQuery.tokenStart);
  const after = input.text.slice(input.activeQuery.tokenEnd);
  const needsSpace = after.length > 0 && !/^\s/.test(after);
  const replacement = `${mentionText}${needsSpace ? " " : ""}`;
  const nextText = `${before}${replacement}${after}`;

  const shiftedMentions = reconcileMentionsOnTextChange(input.text, nextText, input.mentions);

  const mentionStart = input.activeQuery.tokenStart;
  const mentionEnd = mentionStart + mentionText.length;

  const nextMentions = sortAndDedupeMentions([
    ...shiftedMentions,
    input.member.kind === "ALL"
      ? {
          kind: "ALL",
          start: mentionStart,
          end: mentionEnd,
        }
      : {
          kind: "MEMBER",
          memberId: input.member.id,
          start: mentionStart,
          end: mentionEnd,
        },
  ]);

  const nextCaret = mentionEnd + (needsSpace ? 1 : 0);

  return {
    text: nextText,
    mentions: nextMentions,
    caret: nextCaret,
  };
}

export function normalizeMentionsForSubmit(input: { text: string; mentions: MentionDraft[] }) {
  const leadingTrim = input.text.length - input.text.trimStart().length;
  const text = input.text.trim();

  if (!text) {
    return {
      text,
      mentions: [] as MentionDraft[],
    };
  }

  const shifted = input.mentions
    .map((mention) => ({
      ...mention,
      start: mention.start - leadingTrim,
      end: mention.end - leadingTrim,
    }))
    .filter((mention) => mention.start >= 0 && mention.end <= text.length && mention.start < mention.end)
    .filter((mention) => text.slice(mention.start, mention.end).startsWith("@"));

  return {
    text,
    mentions: sortAndDedupeMentions(shifted),
  };
}

export function filterMentionMembers(input: {
  members: MentionableMember[];
  activeQuery: ActiveMentionQuery | null;
}) {
  if (!input.activeQuery) {
    return [] as MentionableMember[];
  }

  const query = input.activeQuery.query.trim().toLowerCase();
  if (!query) {
    return input.members.slice(0, 8);
  }

  return input.members
    .filter((member) => member.name.toLowerCase().includes(query))
    .slice(0, 8);
}

export function getMentionPopoverAnchor(input: {
  textarea: HTMLTextAreaElement;
  triggerIndex: number;
  popoverWidth?: number;
}): MentionPopoverAnchor | null {
  const { textarea, triggerIndex, popoverWidth = 288 } = input;
  if (triggerIndex < 0 || triggerIndex > textarea.value.length) {
    return null;
  }

  const styles = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.pointerEvents = "none";
  mirror.style.boxSizing = styles.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = styles.font;
  mirror.style.fontSize = styles.fontSize;
  mirror.style.fontFamily = styles.fontFamily;
  mirror.style.fontWeight = styles.fontWeight;
  mirror.style.fontStyle = styles.fontStyle;
  mirror.style.letterSpacing = styles.letterSpacing;
  mirror.style.lineHeight = styles.lineHeight;
  mirror.style.paddingTop = styles.paddingTop;
  mirror.style.paddingRight = styles.paddingRight;
  mirror.style.paddingBottom = styles.paddingBottom;
  mirror.style.paddingLeft = styles.paddingLeft;
  mirror.style.borderTopWidth = styles.borderTopWidth;
  mirror.style.borderRightWidth = styles.borderRightWidth;
  mirror.style.borderBottomWidth = styles.borderBottomWidth;
  mirror.style.borderLeftWidth = styles.borderLeftWidth;

  const before = textarea.value.slice(0, triggerIndex);
  const triggerChar = textarea.value[triggerIndex] ?? "@";
  mirror.textContent = before;
  marker.textContent = triggerChar;
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const parsedLineHeight = Number.parseFloat(styles.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight)
    ? parsedLineHeight
    : Number.parseFloat(styles.fontSize) * 1.4;

  const horizontalInset = 8;
  const rawLeft = marker.offsetLeft - textarea.scrollLeft;
  const maxLeft = Math.max(horizontalInset, textarea.clientWidth - popoverWidth - horizontalInset);
  const left = Math.max(horizontalInset, Math.min(rawLeft, maxLeft));
  const top = marker.offsetTop - textarea.scrollTop + lineHeight + 6;

  document.body.removeChild(mirror);

  return {
    left,
    top,
  };
}

function sortAndDedupeMentions(mentions: MentionDraft[]) {
  const mentionIdentity = (mention: MentionDraft) =>
    mention.kind === "ALL" ? "ALL" : mention.memberId;

  const sorted = [...mentions]
    .sort((a, b) => a.start - b.start || a.end - b.end || mentionIdentity(a).localeCompare(mentionIdentity(b)));

  const deduped: MentionDraft[] = [];
  const seen = new Set<string>();

  for (const mention of sorted) {
    const key = `${mentionIdentity(mention)}:${mention.start}:${mention.end}`;
    if (seen.has(key)) {
      continue;
    }

    const previous = deduped[deduped.length - 1];
    if (previous && mention.start < previous.end) {
      continue;
    }

    seen.add(key);
    deduped.push(mention);
  }

  return deduped;
}
