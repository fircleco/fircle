import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import type { MentionPopoverAnchor, MentionableMember } from "./mention-helpers";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type MentionSuggestionsPopoverProps = {
  members: MentionableMember[];
  activeIndex: number;
  onSelect: (member: MentionableMember) => void;
  onHover: (index: number) => void;
  emptyLabel?: string;
  anchor?: MentionPopoverAnchor | null;
};

export function MentionSuggestionsPopover({
  members,
  activeIndex,
  onSelect,
  onHover,
  emptyLabel = "No members found",
  anchor,
}: MentionSuggestionsPopoverProps) {
  return (
    <div
      className="absolute z-30 max-h-64 w-fit max-w-[calc(100%-0.5rem)] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl"
      style={
        anchor
          ? {
              left: `${anchor.left}px`,
              top: `${anchor.top}px`,
            }
          : {
              left: "0.5rem",
              top: "calc(100% + 0.5rem)",
            }
      }
    >
      {members.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto p-1">
          {members.map((member, index) => (
            <li key={member.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors rounded-xl ${
                  index === activeIndex ? "bg-muted/70" : "hover:bg-muted/50"
                }`}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(member);
                }}
              >
                {member.kind === "ALL" ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-foreground">
                    @
                  </span>
                ) : (
                  <Avatar className="size-6 shrink-0">
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                    <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate font-medium text-foreground">
                  {member.kind === "ALL" ? "all members" : member.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
