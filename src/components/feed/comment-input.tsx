"use client";

import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";

type CommentInputProps = {
  user?: {
    name: string;
    avatarUrl?: string;
  };
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  pending?: boolean;
  onCancel?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function CommentInput({
  user,
  value,
  onChange,
  onSubmit,
  placeholder = "Post your reply",
  submitLabel = "Reply",
  pending = false,
  onCancel,
  compact = false,
  autoFocus = false,
}: CommentInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const isExpanded = isFocused || hasText;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!hasText) {
      textarea.style.height = "";
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [hasText, value]);

  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return;
    textareaRef.current.focus();
  }, [autoFocus]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!hasText || pending) return;
        onSubmit();
      }}
      className={`flex items-start gap-3 rounded-2xl border border-border/80 bg-card/90 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <Avatar className="size-9 shrink-0 border border-border">
        {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
        <AvatarFallback className="text-xs font-semibold text-foreground">
          {user?.name ? getInitials(user.name) : "ME"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="mt-0.5 min-h-6 w-full resize-none bg-transparent py-1 leading-5 text-foreground placeholder:text-muted-foreground outline-none"
          disabled={pending}
        />

        {isExpanded ? (
          <div className="mt-2 flex items-center justify-end gap-2">
            {onCancel ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 rounded-full px-4"
                onClick={onCancel}
                disabled={pending}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-full px-4 font-semibold"
              disabled={!hasText || pending}
            >
              {pending ? "Saving..." : submitLabel}
            </Button>
          </div>
        ) : null}
      </div>

      {!isExpanded ? (
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 rounded-full px-4 font-semibold"
          disabled={!hasText || pending}
        >
          {pending ? "Saving..." : submitLabel}
        </Button>
      ) : null}
    </form>
  );
}
