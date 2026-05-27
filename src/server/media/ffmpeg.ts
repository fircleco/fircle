import "server-only";

import { existsSync } from "node:fs";
import { join, normalize } from "node:path";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

let configured = false;

function resolveFfmpegBinaryPath(binaryPath: string) {
  const rootPrefixPattern = /^[\\/]+ROOT[\\/]+/i;

  const rootedPath = rootPrefixPattern.test(binaryPath)
    ? join(process.cwd(), binaryPath.replace(rootPrefixPattern, ""))
    : binaryPath;

  return normalize(rootedPath);
}

function ensureFfmpegPath() {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary is unavailable in this environment.");
  }

  if (!configured) {
    const resolvedBinaryPath = resolveFfmpegBinaryPath(ffmpegStatic);

    if (!existsSync(resolvedBinaryPath)) {
      throw new Error(
        [
          "ffmpeg binary does not exist at resolved path.",
          `original: ${ffmpegStatic}`,
          `resolved: ${resolvedBinaryPath}`,
          `cwd: ${process.cwd()}`,
        ].join(" "),
      );
    }

    ffmpeg.setFfmpegPath(resolvedBinaryPath);
    configured = true;
  }
}

export function transcodeVideoToMp4(inputPath: string, outputPath: string) {
  ensureFfmpegPath();

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 28",
        "-c:a aac",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
      ])
      .videoFilters("scale=min(1280\\,iw):-2")
      .format("mp4")
      .on("end", () => {
        resolve();
      })
      .on("error", (error, stdout, stderr) => {
        const segments = [
          error.message,
          stderr?.trim() ? `stderr: ${stderr.trim()}` : undefined,
          stdout?.trim() ? `stdout: ${stdout.trim()}` : undefined,
        ].filter((value): value is string => Boolean(value));

        reject(new Error(segments.join("\n"), { cause: error }));
      })
      .save(outputPath);
  });
}
