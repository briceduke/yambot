import { sleepAsync } from "@yambot/audio-engine/bench";
import type { TrackAudio } from "@yambot/audio-engine";

import type { VoicePort } from "../guild-music-session.ts";

/**
 * Voice port with no Discord and no AudioPlayer. Optional join delay
 * for the injected TTFA bench.
 */
export class StubVoicePort implements VoicePort {
  readonly #joinDelayMs: number;
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;

  /**
   * @param joinDelayMs - Extra wait inside `join`. Zero for the load mock.
   */
  constructor(joinDelayMs: number = 0) {
    this.#joinDelayMs = joinDelayMs;
  }

  async join(channelId: string): Promise<void> {
    if (this.#joinDelayMs > 0) {
      await sleepAsync(this.#joinDelayMs);
    }
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "bench";
  }

  async play(_audio: TrackAudio): Promise<void> {
    return;
  }

  stop(): void {
    this.#idleHandler?.();
  }

  pause(): boolean {
    return false;
  }

  unpause(): boolean {
    return false;
  }

  isPaused(): boolean {
    return false;
  }

  playbackDurationMs(): number {
    return 0;
  }

  destroy(): void {
    this.#channelId = null;
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(_handler: () => void): void {
    return;
  }
}
