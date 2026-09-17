import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  NoSubscriberBehavior,
  type AudioPlayer,
} from "@discordjs/voice";
import type { TrackAudio } from "@yambot/audio-engine";
import { Readable } from "node:stream";

import { streamTypeFor } from "../discord-voice.ts";
import type { VoicePort } from "../guild-music-session.ts";

const PLAYING_TIMEOUT_MS = 10_000;

/**
 * Voice port that plays through `@discordjs/voice` with no Discord UDP.
 * Used by the HTTP bake-off and the load bench.
 */
export class HeadlessVoicePort implements VoicePort {
  readonly #player: AudioPlayer;
  readonly #waitUntilPlaying: boolean;
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;

  /**
   * @param waitUntilPlaying - When true, `play` waits for AudioPlayer Playing.
   */
  constructor(waitUntilPlaying: boolean) {
    this.#waitUntilPlaying = waitUntilPlaying;
    this.#player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    this.#player.on("stateChange", (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Paused) {
        return;
      }
      if (
        oldState.status !== AudioPlayerStatus.Idle &&
        newState.status === AudioPlayerStatus.Idle
      ) {
        this.#idleHandler?.();
      }
    });
  }

  async join(channelId: string): Promise<void> {
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "bench";
  }

  async play(audio: TrackAudio): Promise<void> {
    const resource = createAudioResource(Readable.fromWeb(audio.stream), {
      inputType: streamTypeFor(audio.format),
      inlineVolume: false,
      silencePaddingFrames: 0,
    });
    this.#player.play(resource);
    if (!this.#waitUntilPlaying) {
      return;
    }
    await entersState(this.#player, AudioPlayerStatus.Playing, PLAYING_TIMEOUT_MS);
  }

  stop(): void {
    this.#player.stop(true);
  }

  pause(): boolean {
    return this.#player.pause();
  }

  unpause(): boolean {
    return this.#player.unpause();
  }

  isPaused(): boolean {
    return this.#player.state.status === AudioPlayerStatus.Paused;
  }

  playbackDurationMs(): number {
    const state = this.#player.state;
    if (
      state.status === AudioPlayerStatus.Playing ||
      state.status === AudioPlayerStatus.Paused
    ) {
      return state.playbackDuration;
    }
    return 0;
  }

  destroy(): void {
    this.#player.stop(true);
    this.#channelId = null;
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(_handler: () => void): void {
    return;
  }
}
