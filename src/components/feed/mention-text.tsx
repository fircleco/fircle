import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

type MentionEntity = {
  id: string;
  start: number;
  end: number;
  member: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string;
  };
};

type MentionTextProps = {
  text: string;
  mentions: MentionEntity[];
  currentMemberSlug?: string;
  className?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeMentions(text: string, mentions: MentionEntity[]) {
  return [...mentions]
    .filter((mention) => mention.start >= 0 && mention.end <= text.length && mention.start < mention.end)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))
    .reduce<MentionEntity[]>((acc, mention) => {
      const previous = acc[acc.length - 1];
      if (previous && mention.start < previous.end) {
        return acc;
      }

      return [...acc, mention];
    }, []);
}

export function MentionText({ text, mentions, currentMemberSlug, className }: MentionTextProps) {
  const normalizedMentions = normalizeMentions(text, mentions);

  if (normalizedMentions.length === 0) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const mention of normalizedMentions) {
    if (mention.start > cursor) {
      parts.push(text.slice(cursor, mention.start));
    }

    const mentionToken = text.slice(mention.start, mention.end);
    const href = mention.member.slug === currentMemberSlug ? "/profile" : `/member/${mention.member.slug}`;

    parts.push(
      <Link
        href={href}
        key={mention.id}
        className="mx-0.5 relative -top-0.5 inline-flex items-center gap-1 align-middle whitespace-nowrap rounded-full px-0.5 hover:underline"
      >
        <Avatar className="size-4">
          <AvatarImage src={mention.member.avatarUrl} alt={mention.member.name} />
          <AvatarFallback className="bg-border text-[8px] font-semibold text-foreground">
            {getInitials(mention.member.name)}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium leading-none text-foreground">{mentionToken.slice(1)}</span>
      </Link>,
    );

    cursor = mention.end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
}
