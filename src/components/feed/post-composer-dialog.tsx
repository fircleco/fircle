"use client";

import Image from "next/image";
import { ImagePlus, Loader, Video, X } from "~/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import type { ComposerOpenMode } from "./composer-entry";
import { canPublishComposerPost } from "./post-composer-logic";
import {
  filterMentionMembers,
  getMentionPopoverAnchor,
  getActiveMentionQuery,
  insertMentionAtQuery,
  normalizeMentionsForSubmit,
  reconcileMentionsOnTextChange,
  type MentionDraft,
  type MentionableMember,
} from "~/components/feed/mention-helpers";
import { MentionSuggestionsPopover } from "~/components/feed/mention-suggestions-popover";
import { createInstantPreviewUrl, resolveMediaMimeType } from "~/lib/media-compression";

type UploadIntentItem = {
  provider: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  object: {
    provider: string;
    bucket: string;
    objectKey: string;
  };
  readUrl: string;
};

type SelectedMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
  caption: string;
  uploadProgress: number;
  uploadError: string | null;
};

const MAX_FILES_PER_POST = 10;

type PostComposerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId?: string;
  initialMode?: ComposerOpenMode;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Upload failed. Please try again.";
}

function uploadFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Network error while uploading media. Check Cloudflare R2 CORS and signed upload URL configuration.",
        ),
      );
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.send(file);
  });
}

export function PostComposerDialog({
  open,
  onOpenChange,
  familyId,
  initialMode,
}: PostComposerDialogProps) {
  const [caption, setCaption] = useState("");
  const [captionMentions, setCaptionMentions] = useState<MentionDraft[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const autoPickerTriggeredRef = useRef(false);
  const selectedMediaRef = useRef<SelectedMedia[]>([]);
  const [captionCaret, setCaptionCaret] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const trpcUtils = api.useUtils();
  const createPost = api.post.create.useMutation();
  const familyMembersQuery = api.familyMember.listFamilyMembers.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: open && Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const mentionMembers = useMemo<MentionableMember[]>(
    () =>
      (familyMembersQuery.data ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.image ?? "",
      })),
    [familyMembersQuery.data],
  );

  const activeMentionQuery =
    captionCaret !== null ? getActiveMentionQuery(caption, captionCaret) : null;
  const mentionSuggestions = filterMentionMembers({
    members: mentionMembers,
    activeQuery: activeMentionQuery,
  });
  const showMentionSuggestions = Boolean(activeMentionQuery) && mentionMembers.length > 0;
  const mentionPopoverAnchor = useMemo(() => {
    if (!activeMentionQuery || !captionTextareaRef.current) {
      return null;
    }

    return getMentionPopoverAnchor({
      textarea: captionTextareaRef.current,
      triggerIndex: activeMentionQuery.tokenStart,
    });
  }, [activeMentionQuery]);

  const canPublish = useMemo(
    () =>
      canPublishComposerPost({
        familyId,
        caption,
        selectedMedia,
        isUploading,
        isPending: createPost.isPending,
      }),
    [caption, createPost.isPending, familyId, isUploading, selectedMedia],
  );

  const revokeObjectUrls = useCallback((media: SelectedMedia[]) => {
    media.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const resetComposer = useCallback(() => {
    setCaption("");
    setCaptionMentions([]);
    setCaptionCaret(null);
    setActiveMentionIndex(0);
    setPublishError(null);
    setPublishSuccess(null);
    setSelectedMedia((current) => {
      revokeObjectUrls(current);
      return [];
    });
  }, [revokeObjectUrls]);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => {
    if (open && initialMode && !autoPickerTriggeredRef.current) {
      autoPickerTriggeredRef.current = true;
      window.setTimeout(() => {
        if (initialMode === "photo") {
          imageInputRef.current?.click();
          return;
        }
        videoInputRef.current?.click();
      }, 0);
    }

    if (!open) {
      autoPickerTriggeredRef.current = false;
    }
  }, [initialMode, open]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(selectedMediaRef.current);
    };
  }, [revokeObjectUrls]);

  useEffect(() => {
    if (activeMentionIndex >= mentionSuggestions.length) {
      setActiveMentionIndex(0);
    }
  }, [activeMentionIndex, mentionSuggestions.length]);

  if (!open) {
    return null;
  }

  const closeDialog = () => {
    if (isUploading || createPost.isPending) {
      return;
    }

    onOpenChange(false);
    resetComposer();
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPublishError(null);
    setPublishSuccess(null);

    const currentMediaCount = selectedMediaRef.current.length;
    if (currentMediaCount >= MAX_FILES_PER_POST) {
      setPublishError(`You can upload up to ${MAX_FILES_PER_POST} files per post.`);
      return;
    }

    const remainingSlots = MAX_FILES_PER_POST - currentMediaCount;
    const nextFiles = files.slice(0, remainingSlots);
    if (nextFiles.length < files.length) {
      setPublishError(`Only ${MAX_FILES_PER_POST} files are allowed per post.`);
    }

    const nextMedia = nextFiles.map((file) => {
        const resolvedMimeType = resolveMediaMimeType(file);
        const id = crypto.randomUUID();
        const previewUrl = createInstantPreviewUrl(file, (upgradedPreviewUrl) => {
          setSelectedMedia((current) => {
            const target = current.find((item) => item.id === id);
            if (!target) {
              URL.revokeObjectURL(upgradedPreviewUrl);
              return current;
            }

            return current.map((item) => {
              if (item.id !== id) {
                return item;
              }

              URL.revokeObjectURL(item.previewUrl);
              return {
                ...item,
                previewUrl: upgradedPreviewUrl,
              };
            });
          });
        });

        return {
          id,
          file,
          previewUrl,
          kind: resolvedMimeType.startsWith("video/") ? ("video" as const) : ("image" as const),
          caption: "",
          uploadProgress: 0,
          uploadError: null,
        };
      });

    setSelectedMedia((current) => {
      return [...current, ...nextMedia];
    });
  };

  const removeMedia = (id: string) => {
    setSelectedMedia((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const updateMediaCaption = (id: string, value: string) => {
    setSelectedMedia((current) =>
      current.map((item) => (item.id === id ? { ...item, caption: value } : item)),
    );
  };

  const handlePublish = async () => {
    if (!familyId || !canPublish || isUploading || createPost.isPending) {
      return;
    }

    setPublishError(null);
    setPublishSuccess(null);
    setIsUploading(selectedMedia.length > 0);

    try {
      const normalizedCaption = normalizeMentionsForSubmit({
        text: caption,
        mentions: captionMentions,
      });

      const uploadedMedia: Array<{
        provider: string;
        bucket: string;
        objectKey: string;
        url: string;
        mimeType: string;
        sizeBytes: number;
        caption?: string;
      }> = [];

      if (selectedMedia.length > 0) {
        const filesPayload = selectedMedia.map((item) => ({
          fileName: item.file.name,
          mimeType: item.file.type,
          sizeBytes: item.file.size,
        }));

        const intentsResponse = await fetch("/api/uploads/intent", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            familyId,
            files: filesPayload,
          }),
        });

        const intentBody = (await intentsResponse.json()) as {
          intents?: UploadIntentItem[];
          error?: { message?: string };
        };

        if (!intentsResponse.ok || !intentBody.intents) {
          throw new Error(intentBody.error?.message ?? "Failed to create upload intents.");
        }

        if (intentBody.intents.length !== selectedMedia.length) {
          throw new Error("Upload intent count does not match selected files.");
        }

        for (let index = 0; index < selectedMedia.length; index++) {
          const media = selectedMedia[index]!;
          const intent = intentBody.intents[index]!;

          try {
            await uploadFileWithProgress(
              intent.uploadUrl,
              media.file,
              intent.requiredHeaders,
              (progress) => {
                setSelectedMedia((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          uploadProgress: progress,
                          uploadError: null,
                        }
                      : item,
                  ),
                );
              },
            );

            uploadedMedia.push({
              provider: intent.object.provider,
              bucket: intent.object.bucket,
              objectKey: intent.object.objectKey,
              url: intent.readUrl,
              mimeType: media.file.type,
              sizeBytes: media.file.size,
              caption: media.caption.trim() || undefined,
            });
          } catch (error) {
            const message = getUploadErrorMessage(error);
            setSelectedMedia((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index
                  ? {
                      ...item,
                      uploadError: message,
                    }
                  : item,
              ),
            );
            throw new Error(message);
          }
        }
      }

      const hasImage = uploadedMedia.some((item) => item.mimeType.startsWith("image/"));
      const hasVideo = uploadedMedia.some((item) => item.mimeType.startsWith("video/"));

      const type = hasImage && hasVideo ? "MIXED" : hasVideo ? "VIDEO" : hasImage ? "PHOTO" : "TEXT";

      await createPost.mutateAsync({
        familyId,
        caption: normalizedCaption.text || undefined,
        mentions: normalizedCaption.mentions,
        type,
        media: uploadedMedia,
      });

      await trpcUtils.post.getFeed.invalidate();
      setPublishSuccess("Memory published.");
      onOpenChange(false);
      resetComposer();
    } catch (error) {
      setPublishError(getUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const applyMentionSelection = (member: MentionableMember) => {
    if (!activeMentionQuery || !captionTextareaRef.current) {
      return;
    }

    const inserted = insertMentionAtQuery({
      text: caption,
      mentions: captionMentions,
      activeQuery: activeMentionQuery,
      member,
    });

    setCaption(inserted.text);
    setCaptionMentions(inserted.mentions);
    setCaptionCaret(inserted.caret);
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      captionTextareaRef.current?.focus();
      captionTextareaRef.current?.setSelectionRange(inserted.caret, inserted.caret);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Create memory"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl tracking-tight">Create memory</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Share a photo, video, or moment with your family.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={closeDialog}
            aria-label="Close composer"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />

          <div className="relative">
            <textarea
              ref={captionTextareaRef}
              value={caption}
              onChange={(event) => {
                const nextCaption = event.target.value;
                setCaptionMentions((current) =>
                  reconcileMentionsOnTextChange(caption, nextCaption, current),
                );
                setCaption(nextCaption);
                setCaptionCaret(event.target.selectionStart ?? nextCaption.length);
              }}
              onFocus={(event) => {
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onBlur={() => {
                setCaptionCaret(null);
              }}
              onClick={(event) => {
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onKeyUp={(event) => {
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onKeyDown={(event) => {
                if (!showMentionSuggestions || mentionSuggestions.length === 0) {
                  return;
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveMentionIndex((current) =>
                    current + 1 >= mentionSuggestions.length ? 0 : current + 1,
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveMentionIndex((current) =>
                    current - 1 < 0 ? mentionSuggestions.length - 1 : current - 1,
                  );
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  const selectedMember = mentionSuggestions[activeMentionIndex];
                  if (selectedMember) {
                    applyMentionSelection(selectedMember);
                  }
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setCaptionCaret(null);
                }
              }}
              placeholder="Write a caption for this memory..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />

            {showMentionSuggestions ? (
              <MentionSuggestionsPopover
                members={mentionSuggestions}
                activeIndex={activeMentionIndex}
                onHover={setActiveMentionIndex}
                onSelect={applyMentionSelection}
                anchor={mentionPopoverAnchor}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <ImagePlus className="size-4" />
              Add photos
            </button>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Video className="size-4" />
              Add videos
            </button>
          </div>

          {selectedMedia.length > 0 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <p className="text-muted-foreground text-xs">
                {selectedMedia.length} / {MAX_FILES_PER_POST} media selected
              </p>
              <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {selectedMedia.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-border/80 bg-muted/30 p-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-background sm:h-20 sm:w-20">
                        {item.kind === "video" ? (
                          <video
                            src={item.previewUrl}
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Image
                            src={item.previewUrl}
                            alt={item.file.name}
                            fill
                            unoptimized
                            sizes="80px"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm text-foreground">{item.file.name}</p>
                            <p className="text-muted-foreground text-xs">{formatBytes(item.file.size)}</p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeMedia(item.id)}
                            disabled={isUploading || createPost.isPending}
                            aria-label="Remove media"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>

                        <input
                          type="text"
                          value={item.caption}
                          onChange={(event) => updateMediaCaption(item.id, event.target.value)}
                          placeholder="Add an optional caption for this media"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                          disabled={isUploading || createPost.isPending}
                        />

                        {(isUploading || item.uploadProgress > 0) && selectedMedia.length > 0 ? (
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${item.uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              Uploaded {item.uploadProgress}%
                            </p>
                          </div>
                        ) : null}

                        {item.uploadError ? (
                          <p className="text-[11px] text-red-500">{item.uploadError}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {publishError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {publishError}
            </p>
          ) : null}

          {publishSuccess ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
              {publishSuccess}
            </p>
          ) : null}

          {!familyId ? (
            <p className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              A family context is required before publishing.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Family-only
            </span>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || isUploading || createPost.isPending}
              >
                {isUploading ? (
                  <>
                    <Loader className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : createPost.isPending ? (
                  <>
                    <Loader className="size-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
