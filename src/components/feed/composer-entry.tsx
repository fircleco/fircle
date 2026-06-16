"use client";

import Image from "next/image";
import { ImagePlus, Loader, Video, X } from "~/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { canPublishComposerPost } from "~/components/feed/post-composer-logic";
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
import {
  compressImage,
  createInstantPreviewUrl,
  resolveMediaMimeType,
  shouldUseServerVideoCompression,
} from "~/lib/media-compression";
import { api } from "~/trpc/react";

export type ComposerOpenMode = "photo" | "video";

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

type VideoIngestedMedia = {
  provider: string;
  bucket: string;
  objectKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

type VideoIngestResponse = {
  media?: VideoIngestedMedia;
  error?: {
    message?: string;
    details?: {
      message?: string;
    };
  };
};

type UploadedMediaPayload = {
  provider: string;
  bucket: string;
  objectKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

type SelectedMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
  resolvedMimeType: string;
  isPreviewConversionPending: boolean;
  previewFailed: boolean;
  compressionProgress: number;
  uploadProgress: number;
  isVideoProcessing: boolean;
  uploadError: string | null;
  uploadedMedia: UploadedMediaPayload | null;
};

const MAX_FILES_PER_POST = 10;

type ComposerEntryProps = {
  user?: {
    name: string;
    avatarUrl?: string;
  };
  familyId?: string;
};

function logUploadError(context: string, error: unknown) {
  console.error(`[ComposerEntry] ${context}`, error);
}

function getFriendlyUploadErrorMessage(fallback: string) {
  return fallback;
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ComposerEntry({ user, familyId }: ComposerEntryProps) {
  const [caption, setCaption] = useState("");
  const [captionMentions, setCaptionMentions] = useState<MentionDraft[]>([]);
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedMediaRef = useRef<SelectedMedia[]>([]);
  const [captionCaret, setCaptionCaret] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const trpcUtils = api.useUtils();
  const createPost = api.post.create.useMutation();
  const familyMembersQuery = api.familyMember.listFamilyMembers.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: Boolean(familyId),
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
        isUploading: isUploading || isCompressing || isProcessingVideo,
        isPending: createPost.isPending,
      }),
    [
      caption,
      createPost.isPending,
      familyId,
      isCompressing,
      isProcessingVideo,
      isUploading,
      selectedMedia,
    ],
  );

  const revokeObjectUrls = useCallback((media: SelectedMedia[]) => {
    media.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

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

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPublishError(null);

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
      const isHeicPreview = resolvedMimeType === "image/heic" || resolvedMimeType === "image/heif";
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
                isPreviewConversionPending: false,
                previewFailed: false,
              };
            });
          });
        }, () => {
          setSelectedMedia((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    isPreviewConversionPending: false,
                    previewFailed: true,
                  }
                : item,
            ),
          );
        });

        return {
          id,
          file,
          previewUrl,
          kind: resolvedMimeType.startsWith("video/") ? ("video" as const) : ("image" as const),
          resolvedMimeType,
          isPreviewConversionPending: isHeicPreview,
          previewFailed: false,
          compressionProgress: 0,
          uploadProgress: 0,
          isVideoProcessing: false,
          uploadError: null,
          uploadedMedia: null,
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

  const handlePublish = async () => {
    if (!familyId || !canPublish || isCompressing || isUploading || isProcessingVideo || createPost.isPending) {
      return;
    }

    setPublishError(null);
    setIsCompressing(selectedMedia.some((item) => item.kind === "image"));
    setIsUploading(false);
    setIsProcessingVideo(false);

    try {
      const normalizedCaption = normalizeMentionsForSubmit({
        text: caption,
        mentions: captionMentions,
      });

      const uploadedMediaById = new Map<
        string,
        UploadedMediaPayload
      >();

      const mediaForUpload: Array<{
        id: string;
        kind: "image" | "video";
        file: File;
      }> = [];

      if (selectedMedia.length > 0) {
        setSelectedMedia((current) =>
          current.map((item) => ({
            ...item,
            compressionProgress: 0,
            uploadProgress: 0,
            isVideoProcessing: false,
            uploadError: null,
          })),
        );

        for (let index = 0; index < selectedMedia.length; index++) {
          const media = selectedMedia[index]!;

          if (media.uploadedMedia) {
            uploadedMediaById.set(media.id, media.uploadedMedia);
            continue;
          }

          if (media.kind === "image") {
            try {
              const compressedFile = await compressImage(media.file, (progress) => {
                setSelectedMedia((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          compressionProgress: progress,
                          uploadError: null,
                        }
                      : item,
                  ),
                );
              });

              mediaForUpload.push({
                id: media.id,
                kind: media.kind,
                file: compressedFile,
              });
            } catch (error) {
              logUploadError("Image compression failed", error);
              const message = getFriendlyUploadErrorMessage("Image processing failed. Please try again.");
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
            continue;
          }

          if (shouldUseServerVideoCompression(media.file)) {
            mediaForUpload.push({
              id: media.id,
              kind: media.kind,
              file: media.file,
            });
            continue;
          }

          mediaForUpload.push({
            id: media.id,
            kind: media.kind,
            file: media.file,
          });
        }

        setIsCompressing(false);

        const imagesForUpload = mediaForUpload.filter((item) => item.kind === "image");
        if (imagesForUpload.length > 0) {
          setIsUploading(true);

          const filesPayload = imagesForUpload.map((item) => ({
            fileName: item.file.name,
            mimeType: resolveMediaMimeType(item.file),
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

          if (intentBody.intents.length !== imagesForUpload.length) {
            throw new Error("Upload intent count does not match selected image files.");
          }

          for (let index = 0; index < imagesForUpload.length; index++) {
            const media = imagesForUpload[index]!;
            const intent = intentBody.intents[index]!;

            try {
              await uploadFileWithProgress(
                intent.uploadUrl,
                media.file,
                intent.requiredHeaders,
                (progress) => {
                  setSelectedMedia((current) =>
                    current.map((item) =>
                      item.id === media.id
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

              uploadedMediaById.set(media.id, {
                provider: intent.object.provider,
                bucket: intent.object.bucket,
                objectKey: intent.object.objectKey,
                url: intent.readUrl,
                mimeType: resolveMediaMimeType(media.file),
                sizeBytes: media.file.size,
              });

              setSelectedMedia((current) =>
                current.map((item) =>
                  item.id === media.id
                    ? {
                        ...item,
                        uploadProgress: 100,
                        uploadedMedia: {
                          provider: intent.object.provider,
                          bucket: intent.object.bucket,
                          objectKey: intent.object.objectKey,
                          url: intent.readUrl,
                          mimeType: resolveMediaMimeType(media.file),
                          sizeBytes: media.file.size,
                        },
                      }
                    : item,
                ),
              );
            } catch (error) {
              logUploadError("Image upload failed", error);
              const friendlyMessage = getFriendlyUploadErrorMessage(
                "Image upload failed. Please try again.",
              );
              setSelectedMedia((current) =>
                current.map((item) =>
                  item.id === media.id
                    ? {
                        ...item,
                        uploadError: friendlyMessage,
                      }
                    : item,
                ),
              );
              throw new Error(friendlyMessage);
            }
          }
        }

        setIsUploading(false);

        const videosForProcessing = mediaForUpload.filter(
          (item) => item.kind === "video" && shouldUseServerVideoCompression(item.file),
        );

        if (videosForProcessing.length > 0) {
          setIsProcessingVideo(true);
        }

        for (const media of videosForProcessing) {
          try {
            setSelectedMedia((current) =>
              current.map((item) =>
                item.id === media.id
                  ? {
                      ...item,
                      isVideoProcessing: true,
                      uploadError: null,
                    }
                  : item,
              ),
            );

            const formData = new FormData();
            formData.set("familyId", familyId);
            formData.set("file", media.file, media.file.name);

            const ingestResponse = await fetch("/api/uploads/video/ingest", {
              method: "POST",
              body: formData,
            });

            const ingestRaw = await ingestResponse.text();
            const ingestBody: VideoIngestResponse | null = (() => {
              if (!ingestRaw) {
                return null;
              }

              try {
                return JSON.parse(ingestRaw) as VideoIngestResponse;
              } catch {
                return null;
              }
            })();

            if (!ingestResponse.ok || !ingestBody?.media) {
              const detailedMessage = ingestBody?.error?.details?.message;
              const apiMessage = ingestBody?.error?.message;
              const fallbackMessage = ingestRaw && !ingestBody ? ingestRaw : undefined;
              throw new Error(
                detailedMessage ??
                  apiMessage ??
                  fallbackMessage ??
                  `Video processing failed (status ${ingestResponse.status}).`,
              );
            }

            const ingestedMedia = ingestBody.media;

            uploadedMediaById.set(media.id, {
              provider: ingestedMedia.provider,
              bucket: ingestedMedia.bucket,
              objectKey: ingestedMedia.objectKey,
              url: ingestedMedia.url,
              mimeType: ingestedMedia.mimeType,
              sizeBytes: ingestedMedia.sizeBytes,
              width: ingestedMedia.width,
              height: ingestedMedia.height,
              durationMs: ingestedMedia.durationMs,
            });

            setSelectedMedia((current) =>
              current.map((item) =>
                item.id === media.id
                  ? {
                      ...item,
                      isVideoProcessing: false,
                      uploadProgress: 100,
                      uploadedMedia: {
                        provider: ingestedMedia.provider,
                        bucket: ingestedMedia.bucket,
                        objectKey: ingestedMedia.objectKey,
                        url: ingestedMedia.url,
                        mimeType: ingestedMedia.mimeType,
                        sizeBytes: ingestedMedia.sizeBytes,
                        width: ingestedMedia.width,
                        height: ingestedMedia.height,
                        durationMs: ingestedMedia.durationMs,
                      },
                    }
                  : item,
              ),
            );
          } catch (error) {
            logUploadError("Video ingest failed", error);
            const friendlyMessage = getFriendlyUploadErrorMessage(
              "Video upload failed. Please try again.",
            );
            setSelectedMedia((current) =>
              current.map((item) =>
                item.id === media.id
                  ? {
                      ...item,
                      isVideoProcessing: false,
                      uploadError: friendlyMessage,
                    }
                  : item,
              ),
            );
            throw new Error(friendlyMessage);
          }
        }

        setIsProcessingVideo(false);
      }

      const uploadedMedia: UploadedMediaPayload[] = selectedMedia.map((media) => {
        const uploaded = uploadedMediaById.get(media.id);
        if (!uploaded) {
          throw new Error("Uploaded media result was missing for one or more files.");
        }

        return uploaded;
      });

      const hasImage = uploadedMedia.some((item) => item.mimeType.startsWith("image/"));
      const hasVideo = uploadedMedia.some((item) => item.mimeType.startsWith("video/"));
      const type = hasImage && hasVideo ? "MIXED" : hasVideo ? "VIDEO" : hasImage ? "PHOTO" : "TEXT";

      await createPost.mutateAsync({
        familyId,
        type,
        caption: normalizedCaption.text || undefined,
        mentions: normalizedCaption.mentions,
        media: uploadedMedia,
      });

      setSelectedMedia((current) => {
        revokeObjectUrls(current);
        return [];
      });
      setCaption("");
      setCaptionMentions([]);
      setCaptionCaret(null);
      setActiveMentionIndex(0);
      await trpcUtils.post.getFeed.invalidate();
    } catch (error) {
      logUploadError("Publishing composer post failed", error);
      setPublishError("Could not publish your post. Please try again.");
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
      setIsProcessingVideo(false);
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
    <section className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0 border border-border" aria-label={user?.name ?? "Current user"}>
          {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback className="text-sm font-semibold text-foreground">
            {user?.name ? getInitials(user.name) : "ME"}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                if (publishError) {
                  setPublishError(null);
                }
              }}
              onFocus={(event) => {
                setIsTextareaExpanded(true);
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onBlur={() => {
                setIsTextareaExpanded(caption.trim().length > 0);
                setCaptionCaret(null);
              }}
              onClick={(event) => {
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onKeyUp={(event) => {
                setCaptionCaret(event.currentTarget.selectionStart ?? caption.length);
              }}
              onKeyDown={(event) => {
                if (showMentionSuggestions && mentionSuggestions.length > 0) {
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
                    return;
                  }
                }

                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handlePublish();
                }
              }}
              placeholder="Share a memory..."
              rows={isTextareaExpanded ? 4 : 1}
              className={`w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-[min-height] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 ${isTextareaExpanded ? "min-h-24" : "min-h-11"}`}
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

          {publishError ? <p className="text-sm text-red-500">{publishError}</p> : null}

          {!familyId ? (
            <p className="text-muted-foreground text-xs">Join a family to publish a memory.</p>
          ) : null}

                    {selectedMedia.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedMedia.map((item) => (
                <li key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-muted/40">
                  <button
                    type="button"
                    aria-label="Remove media"
                    className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1 text-foreground shadow"
                    onClick={() => removeMedia(item.id)}
                    disabled={isCompressing || isUploading || isProcessingVideo || createPost.isPending}
                  >
                    <X className="size-3" />
                  </button>

                  {item.uploadedMedia ? (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                      Uploaded
                    </span>
                  ) : null}

                  {item.kind === "video" ? (
                    <video src={item.previewUrl} className="h-28 w-full object-cover" muted playsInline />
                  ) : item.isPreviewConversionPending ? (
                    <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-muted px-2 text-center text-[11px] text-muted-foreground">
                      <Loader className="size-4 animate-spin" aria-hidden="true" />
                      <span>Preparing preview...</span>
                    </div>
                  ) : item.previewFailed && !item.isPreviewConversionPending ? (
                    <div className="flex h-28 w-full items-center justify-center bg-muted px-2 text-center text-[11px] text-muted-foreground">
                      Preview unavailable for this image format.
                    </div>
                  ) : (
                    <div className="relative h-28 w-full">
                      <Image
                        src={item.previewUrl}
                        alt={item.file.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                        onError={() => {
                          setSelectedMedia((current) =>
                            current.map((media) =>
                              media.id === item.id && !media.isPreviewConversionPending
                                ? {
                                    ...media,
                                    previewFailed: true,
                                  }
                                : media,
                            ),
                          );
                        }}
                      />
                    </div>
                  )}

                  {(isCompressing ||
                    isUploading ||
                    isProcessingVideo ||
                    item.isVideoProcessing ||
                    item.compressionProgress > 0 ||
                    item.uploadProgress > 0) &&
                  selectedMedia.length > 0 ? (
                    <div className="border-border/80 border-t bg-background px-2 py-1.5">
                      {(isCompressing || item.compressionProgress > 0) && item.kind === "image" ? (
                        <div className="mb-1.5">
                          <p className="mb-1 text-[10px] text-muted-foreground">Compressing {item.compressionProgress}%</p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-sky-500 transition-all"
                              style={{ width: `${item.compressionProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {(isUploading || item.uploadProgress > 0) ? (
                        <div>
                          <p className="mb-1 text-[10px] text-muted-foreground">Uploading {item.uploadProgress}%</p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${item.uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {(isProcessingVideo || item.isVideoProcessing) && item.kind === "video" ? (
                        <p className="text-[10px] text-muted-foreground">Processing video...</p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.uploadError ? (
                    <p className="truncate border-border/80 border-t bg-background px-2 py-1 text-[11px] text-red-500">
                      {item.uploadError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                onClick={() => imageInputRef.current?.click()}
                disabled={isCompressing || isUploading || isProcessingVideo || createPost.isPending}
              >
                <ImagePlus className="size-4" />
                Photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                onClick={() => videoInputRef.current?.click()}
                disabled={isCompressing || isUploading || isProcessingVideo || createPost.isPending}
              >
                <Video className="size-4" />
                Video
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              className="rounded-2xl"
              onClick={() => void handlePublish()}
              disabled={!canPublish}
            >
              {isCompressing ? (
                <>
                  <Loader className="size-4 animate-spin" />
                  Compressing...
                </>
              ) : isProcessingVideo ? (
                <>
                  <Loader className="size-4 animate-spin" />
                  Processing video...
                </>
              ) : isUploading ? (
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
                "Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
