import type { MediaType } from "@/types/timeline";

/** Guess MediaType from a File's MIME type. */
export function mediaTypeFromFile(file: File): MediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

/**
 * Read duration (seconds) from a video or audio object URL.
 * Images return undefined.
 */
export function readMediaDuration(
  objectUrl: string,
  type: MediaType
): Promise<number | undefined> {
  if (type === "image") return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const el = document.createElement(type === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.src = objectUrl;
    el.onloadedmetadata = () => {
      const d = el.duration;
      resolve(Number.isFinite(d) ? d : undefined);
      el.remove();
    };
    el.onerror = () => {
      resolve(undefined);
      el.remove();
    };
  });
}
