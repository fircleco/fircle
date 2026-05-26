"use client";

import Image from "next/image";
import { ImagePlus, Loader, Video, X } from "~/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { canPublishComposerPost } from "~/components/feed/post-composer-logic";
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

type SelectedMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
  uploadProgress: number;
  uploadError: string | null;
};

const MAX_FILES_PER_POST = 10;

type ComposerEntryProps = {
  user?: {
    name: string;
    avatarUrl?: string;
  };
  familyId?: string;
};

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
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const selectedMediaRef = useRef<SelectedMedia[]>([]);
  const trpcUtils = api.useUtils();
  const createPost = api.post.create.useMutation();

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

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(selectedMediaRef.current);
    };
  }, [revokeObjectUrls]);

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPublishError(null);

    setSelectedMedia((current) => {
      if (current.length >= MAX_FILES_PER_POST) {
        setPublishError(`You can upload up to ${MAX_FILES_PER_POST} files per post.`);
        return current;
      }

      const remainingSlots = MAX_FILES_PER_POST - current.length;
      const nextFiles = files.slice(0, remainingSlots);
      if (nextFiles.length < files.length) {
        setPublishError(`Only ${MAX_FILES_PER_POST} files are allowed per post.`);
      }

      const nextMedia = nextFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        uploadProgress: 0,
        uploadError: null,
      }));

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
    if (!familyId || !canPublish || isUploading || createPost.isPending) {
      return;
    }

    setPublishError(null);
    setIsUploading(selectedMedia.length > 0);

    try {
      const uploadedMedia: Array<{
        provider: string;
        bucket: string;
        objectKey: string;
        url: string;
        mimeType: string;
        sizeBytes: number;
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
        type,
        caption: caption.trim() || undefined,
        media: uploadedMedia,
      });

      setSelectedMedia((current) => {
        revokeObjectUrls(current);
        return [];
      });
      setCaption("");
      await trpcUtils.post.getFeed.invalidate();
    } catch (error) {
      setPublishError(getUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
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

          <textarea
            value={caption}
            onChange={(event) => {
              setCaption(event.target.value);
              if (publishError) {
                setPublishError(null);
              }
            }}
            onFocus={() => {
              setIsTextareaExpanded(true);
            }}
            onBlur={() => {
              setIsTextareaExpanded(caption.trim().length > 0);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handlePublish();
              }
            }}
            placeholder="Share a memory..."
            rows={isTextareaExpanded ? 4 : 1}
            className={`w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-[min-height] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 ${isTextareaExpanded ? "min-h-24" : "min-h-11"}`}
          />

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
                    disabled={isUploading || createPost.isPending}
                  >
                    <X className="size-3" />
                  </button>

                  {item.kind === "video" ? (
                    <video src={item.previewUrl} className="h-28 w-full object-cover" muted playsInline />
                  ) : (
                    <div className="relative h-28 w-full">
                      <Image
                        src={item.previewUrl}
                        alt={item.file.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  {(isUploading || item.uploadProgress > 0) && selectedMedia.length > 0 ? (
                    <div className="border-border/80 border-t bg-background px-2 py-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${item.uploadProgress}%` }}
                        />
                      </div>
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
                disabled={isUploading || createPost.isPending}
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
                disabled={isUploading || createPost.isPending}
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
                "Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
