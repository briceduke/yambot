import { LAVALINK_PASSWORD } from "./pin.ts";

const START_TIMEOUT_MS = 8_000;

/** Outcome of REST loadtracks. */
export interface LoadOutcome {
  readonly ok: boolean;
  readonly elapsedMs: number;
  readonly encoded: string | null;
  readonly loadType: string | null;
  readonly error: string | null;
}

/**
 * Lavalink v4 REST + WS session for headless load/play/skip.
 */
export class LavalinkClient {
  readonly #port: number;
  readonly #password: string;
  readonly #ws: WebSocket;
  readonly #waiters: Map<string, (message: WsEvent) => void> = new Map();
  #sessionId: string;

  private constructor(
    port: number,
    password: string,
    ws: WebSocket,
    sessionId: string,
  ) {
    this.#port = port;
    this.#password = password;
    this.#ws = ws;
    this.#sessionId = sessionId;
    this.#ws.addEventListener("message", (event) => {
      this.#onMessage(String(event.data));
    });
  }

  /**
   * Opens `/v4/websocket` and waits for the ready op.
   * @param port - Localhost REST/WS port.
   * @returns Connected client.
   */
  static async connectAsync(port: number): Promise<LavalinkClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v4/websocket`, {
      headers: {
        Authorization: LAVALINK_PASSWORD,
        "User-Id": "1",
        "Client-Name": "yambot-bench/0.0.0",
      },
    });
    const sessionId: string = await waitReadySessionIdAsync(ws);
    return new LavalinkClient(port, LAVALINK_PASSWORD, ws, sessionId);
  }

  /**
   * Times GET /v4/loadtracks.
   * @param identifier - URL or search id.
   * @returns Encoded track when loadType is track.
   */
  async loadTracksAsync(identifier: string): Promise<LoadOutcome> {
    const startedAt: number = performance.now();
    try {
      const url = `http://127.0.0.1:${this.#port}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;
      const response: Response = await fetch(url, {
        headers: { Authorization: this.#password },
        signal: AbortSignal.timeout(12_000),
      });
      const elapsedMs: number = performance.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          elapsedMs,
          encoded: null,
          loadType: null,
          error: `HTTP ${response.status}`,
        };
      }
      const body: LoadBody = (await response.json()) as LoadBody;
      return parseLoadBody(body, elapsedMs);
    } catch (error) {
      return {
        ok: false,
        elapsedMs: performance.now() - startedAt,
        encoded: null,
        loadType: null,
        error: errorMessage(error),
      };
    }
  }

  /**
   * PATCH-plays an encoded track and waits for TrackStartEvent.
   * @param guildId - Synthetic guild id.
   * @param encoded - Base64 track from loadtracks.
   * @returns Milliseconds until TrackStartEvent.
   */
  async playUntilStartAsync(guildId: string, encoded: string): Promise<number> {
    const startedAt: number = performance.now();
    const startKey = `${guildId}:TrackStartEvent`;
    const errorKey = `${guildId}:TrackExceptionEvent`;
    const done: Promise<void> = new Promise((resolve, reject) => {
      this.#waiters.set(startKey, () => {
        resolve();
      });
      this.#waiters.set(errorKey, () => {
        reject(new Error(`Lavalink TrackExceptionEvent guild=${guildId}`));
      });
    });
    try {
      await this.#patchPlayerAsync(guildId, encoded);
      await Promise.race([done, timeoutAsync(START_TIMEOUT_MS, "TrackStartEvent")]);
      return performance.now() - startedAt;
    } finally {
      this.#waiters.delete(startKey);
      this.#waiters.delete(errorKey);
    }
  }

  /**
   * Stops the player (encoded track null).
   * @param guildId - Synthetic guild id.
   */
  async stopPlayerAsync(guildId: string): Promise<void> {
    const url = this.#playerUrl(guildId);
    await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: this.#password,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ track: { encoded: null } }),
    });
  }

  /**
   * Deletes the player.
   * @param guildId - Synthetic guild id.
   */
  async destroyPlayerAsync(guildId: string): Promise<void> {
    await fetch(this.#playerUrl(guildId), {
      method: "DELETE",
      headers: { Authorization: this.#password },
      signal: AbortSignal.timeout(8_000),
    });
  }

  /** Closes the WebSocket. */
  close(): void {
    this.#ws.close();
  }

  #playerUrl(guildId: string): string {
    return `http://127.0.0.1:${this.#port}/v4/sessions/${this.#sessionId}/players/${guildId}`;
  }

  async #patchPlayerAsync(guildId: string, encoded: string): Promise<void> {
    const response: Response = await fetch(this.#playerUrl(guildId), {
      method: "PATCH",
      headers: {
        Authorization: this.#password,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ track: { encoded } }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const text: string = await response.text();
      throw new Error(`PATCH player HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
  }

  #onMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isRecord(parsed) || parsed.op !== "event") {
      return;
    }
    const guildId: string = String(parsed.guildId ?? "");
    const type: string = String(parsed.type ?? "");
    const waiter = this.#waiters.get(`${guildId}:${type}`);
    waiter?.({ guildId, type });
  }
}

interface WsEvent {
  readonly guildId: string;
  readonly type: string;
}

interface LoadBody {
  readonly loadType?: unknown;
  readonly data?: unknown;
}

function parseLoadBody(body: LoadBody, elapsedMs: number): LoadOutcome {
  const loadType: string = typeof body.loadType === "string" ? body.loadType : "unknown";
  if (loadType === "track" && isRecord(body.data) && typeof body.data.encoded === "string") {
    return {
      ok: true,
      elapsedMs,
      encoded: body.data.encoded,
      loadType,
      error: null,
    };
  }
  if (loadType === "search" && Array.isArray(body.data)) {
    const first: unknown = body.data[0];
    if (isRecord(first) && typeof first.encoded === "string") {
      return {
        ok: true,
        elapsedMs,
        encoded: first.encoded,
        loadType,
        error: null,
      };
    }
  }
  const error: string = loadErrorMessage(body, loadType);
  return {
    ok: false,
    elapsedMs,
    encoded: null,
    loadType,
    error,
  };
}

function loadErrorMessage(body: LoadBody, loadType: string): string {
  if (loadType === "error" && isRecord(body.data) && typeof body.data.message === "string") {
    return body.data.message;
  }
  return `loadType=${loadType}`;
}

async function waitReadySessionIdAsync(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      reject(new Error("Lavalink websocket ready timed out."));
    }, 10_000);
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("Lavalink websocket failed."));
    });
    ws.addEventListener("message", (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!isRecord(parsed) || parsed.op !== "ready") {
        return;
      }
      if (typeof parsed.sessionId !== "string") {
        return;
      }
      clearTimeout(timer);
      resolve(parsed.sessionId);
    });
  });
}

function timeoutAsync(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} (${ms} ms).`));
    }, ms);
    timer.unref?.();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
