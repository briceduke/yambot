import {
  oneTrackResult,
  TrackResolveError,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "../track.ts";

/** Router-only signal that this URL is not an HTTP audio stream. Do not show to users. */
export const NOT_HTTP_STREAM = "NOT_HTTP_STREAM";

const PLAY_FAILED = "Couldn't play that stream.";
const AUDIO_EXTENSIONS = [".mp3", ".aac", ".ogg", ".opus", ".m4a"] as const;
const AUDIO_CONTENT_TYPE_PREFIXES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/mp4",
] as const;
const HEAD_TIMEOUT_MS = 5_000;

export interface HttpUrlQuery {
  readonly kind: "http-url";
  readonly url: string;
}

export interface HttpStreamClient {
  probe(url: string): Promise<{
    readonly isAudio: boolean;
    readonly contentType: string | null;
    readonly icyName: string | null;
  }>;
  openBody(url: string): Promise<ReadableStream<Uint8Array>>;
}

let defaultClient: HttpStreamClient | undefined;

/**
 * Classifies a query as a non-YouTube, non-SoundCloud HTTP URL.
 * @param query - Raw play query.
 * @returns HTTP URL payload, or `null`.
 */
export function parseHttpQuery(query: string): HttpUrlQuery | null {
  const trimmed: string = query.trim();
  if (!URL.canParse(trimmed)) {
    return null;
  }
  const url: URL = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (isYoutubeHost(url.hostname) || isSoundCloudHost(url.hostname)) {
    return null;
  }
  return { kind: "http-url", url: trimmed };
}

/**
 * Resolves an HTTP URL to one stream track, or throws `NOT_HTTP_STREAM`.
 * @param input - Query to resolve.
 * @param client - Testable HTTP wrapper.
 * @returns One stream track.
 */
export async function resolveHttpStreamWithClient(
  input: { readonly query: string },
  client: HttpStreamClient,
): Promise<ResolveResult> {
  const parsed: HttpUrlQuery | null = parseHttpQuery(input.query);
  if (parsed === null) {
    throw new TrackResolveError(NOT_HTTP_STREAM);
  }
  return resolveParsedHttpAsync(parsed.url, client);
}

/**
 * Opens the HTTP body for a resolved stream track.
 * @param input - Track whose `uri` is the stream URL.
 * @param client - Testable HTTP wrapper.
 * @returns Stream and format.
 */
export async function openHttpAudioWithClient(
  input: { readonly track: Track },
  client: HttpStreamClient,
): Promise<TrackAudio> {
  try {
    const stream: ReadableStream<Uint8Array> = await client.openBody(
      input.track.uri,
    );
    return { stream, format: "http/mpeg" };
  } catch (error) {
    throw toStreamError(error);
  }
}

/**
 * Returns the shared default HTTP stream client.
 * @returns Injectable wrapper around `fetch`.
 */
export function getDefaultHttpStreamClient(): HttpStreamClient {
  defaultClient ??= createFetchHttpClient();
  return defaultClient;
}

async function resolveParsedHttpAsync(
  url: string,
  client: HttpStreamClient,
): Promise<ResolveResult> {
  if (hasAudioExtension(url)) {
    return oneTrackResult(streamTrack(url, streamTitle(url, null)));
  }
  const probe = await probeOrNotAudioAsync(client, url);
  if (!probe.isAudio) {
    throw new TrackResolveError(NOT_HTTP_STREAM);
  }
  return oneTrackResult(streamTrack(url, streamTitle(url, probe.icyName)));
}

async function probeOrNotAudioAsync(
  client: HttpStreamClient,
  url: string,
): Promise<{
  readonly isAudio: boolean;
  readonly contentType: string | null;
  readonly icyName: string | null;
}> {
  try {
    return await client.probe(url);
  } catch {
    return { isAudio: false, contentType: null, icyName: null };
  }
}

function streamTrack(url: string, title: string): Track {
  return { title, uri: url, durationSeconds: 0 };
}

function hasAudioExtension(url: string): boolean {
  const pathname: string = new URL(url).pathname.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function streamTitle(url: string, icyName: string | null): string {
  if (icyName !== null && icyName !== "") {
    return icyName;
  }
  const segment: string = lastPathSegment(new URL(url).pathname);
  if (segment !== "") {
    return stripExtension(segment);
  }
  return new URL(url).hostname;
}

function lastPathSegment(pathname: string): string {
  const parts: readonly string[] = pathname.split("/").filter((part) => part !== "");
  return parts[parts.length - 1] ?? "";
}

function stripExtension(segment: string): string {
  const dot: number = segment.lastIndexOf(".");
  if (dot <= 0) {
    return segment;
  }
  return segment.slice(0, dot);
}

function isAudioContentType(contentType: string | null): boolean {
  if (contentType === null || contentType === "") {
    return false;
  }
  const mediaType: string = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType === "application/ogg") {
    return true;
  }
  return AUDIO_CONTENT_TYPE_PREFIXES.some((prefix) =>
    mediaType.startsWith(prefix),
  );
}

function createFetchHttpClient(): HttpStreamClient {
  return {
    probe: (url) => probeWithFetchAsync(url),
    openBody: (url) => openBodyWithFetchAsync(url),
  };
}

async function probeWithFetchAsync(url: string): Promise<{
  readonly isAudio: boolean;
  readonly contentType: string | null;
  readonly icyName: string | null;
}> {
  const controller: AbortController = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort();
  }, HEAD_TIMEOUT_MS);
  try {
    const response: Response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    const contentType: string | null = response.headers.get("content-type");
    return {
      isAudio: isAudioContentType(contentType),
      contentType,
      icyName: response.headers.get("icy-name"),
    };
  } catch {
    return { isAudio: false, contentType: null, icyName: null };
  } finally {
    clearTimeout(timer);
  }
}

async function openBodyWithFetchAsync(
  url: string,
): Promise<ReadableStream<Uint8Array>> {
  const response: Response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new TrackResolveError(PLAY_FAILED);
  }
  return response.body;
}

function toStreamError(error: unknown): TrackResolveError {
  if (error instanceof TrackResolveError) {
    return error;
  }
  return new TrackResolveError(PLAY_FAILED);
}

function isYoutubeHost(hostname: string): boolean {
  return hostname === "youtu.be" || hostname.endsWith("youtube.com");
}

function isSoundCloudHost(hostname: string): boolean {
  return (
    hostname === "soundcloud.com" ||
    hostname.endsWith(".soundcloud.com") ||
    hostname === "snd.sc"
  );
}
