import {
  TrackQueue,
  TrackResolveError,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";

import { formatDuration } from "./format-duration.ts";

/** Engine resolve and open functions. Matches `@yambot/audio-engine` signatures. */
export interface EnginePort {
  resolveTrack(input: {
    readonly query: string;
    readonly source?: "soundcloud";
  }): Promise<ResolveResult>;
  openTrackAudio(input: { readonly track: Track }): Promise<TrackAudio>;
}

/** Bot-owned voice connection and player. */
export interface VoicePort {
  join(channelId: string): Promise<void>;
  getChannelId(): string | null;
  getChannelName(): string;
  play(audio: TrackAudio): Promise<void>;
  stop(): void;
  /** Pauses playback. @returns Whether the player paused. */
  pause(): boolean;
  /** Resumes playback. @returns Whether the player unpaused. */
  unpause(): boolean;
  /** @returns Whether the player is in the Paused status. */
  isPaused(): boolean;
  /** @returns Elapsed playback milliseconds, or `0` when not Playing or Paused. */
  playbackDurationMs(): number;
  /** Destroys the voice connection. */
  destroy(): void;
  onIdle(handler: () => void): void;
  onDisconnected(handler: () => void): void;
}

/**
 * Schedules the idle-leave callback and returns a cancel function.
 * @param callback - Leave helper to run after the delay.
 * @param delayMs - Wait before leaving, in milliseconds.
 * @returns Function that cancels the scheduled leave.
 */
export interface ScheduleIdleLeave {
  (callback: () => void, delayMs: number): () => void;
}

/** Operator leave timings for one guild session. */
export interface LeavePolicy {
  /** Wait after the queue empties before leaving, in milliseconds. */
  readonly idleLeaveMs: number;
  /** When true, do not leave after the queue empties. */
  readonly stayInChannel: boolean;
  /**
   * Wait after the last human leaves voice before dropping the session,
   * in milliseconds. `0` means the alone timer never arms.
   */
  readonly aloneTimeUntilStopMs: number;
}

export interface CreateSessionInput {
  readonly guildId: string;
  readonly engine: EnginePort;
  readonly voice: VoicePort;
  readonly leavePolicy?: LeavePolicy;
  readonly scheduleIdleLeave?: ScheduleIdleLeave;
  readonly scheduleAloneLeave?: ScheduleIdleLeave;
}

export interface SessionSnapshot {
  readonly current: Track | null;
  readonly upcoming: readonly Track[];
}

/** Idle-leave wait after the queue empties while still in voice, in milliseconds. */
export const IDLE_LEAVE_AFTER_MS: number = 300_000;

const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  idleLeaveMs: IDLE_LEAVE_AFTER_MS,
  stayInChannel: false,
  aloneTimeUntilStopMs: 0,
};

const sessions: Map<string, GuildMusicSession> = new Map();

/**
 * Returns the in-memory session for a guild, if one exists.
 * @param guildId - Discord guild id.
 * @returns The session, or `undefined`.
 */
export function getSession(guildId: string): GuildMusicSession | undefined {
  return sessions.get(guildId);
}

/**
 * Creates and registers one guild music session.
 * @param input - Guild id, engine port, voice port, leave policy, and optional schedulers.
 * @returns The new session.
 */
export function createSession(input: CreateSessionInput): GuildMusicSession {
  const session: GuildMusicSession = new GuildMusicSession(input);
  sessions.set(input.guildId, session);
  return session;
}

/**
 * Cancels idle and alone leave, removes the guild session, then stops and
 * destroys voice. Idempotent when the session is already gone.
 * @param guildId - Discord guild id.
 */
export function dropSession(guildId: string): void {
  const session: GuildMusicSession | undefined = sessions.get(guildId);
  if (session === undefined) {
    return;
  }
  session.leaveNow();
}

/**
 * Per-guild playback session: engine queue, current track, voice, announce.
 */
export class GuildMusicSession {
  readonly engine: EnginePort;
  readonly #guildId: string;
  readonly #voice: VoicePort;
  readonly #queue: TrackQueue = new TrackQueue();
  readonly #leavePolicy: LeavePolicy;
  readonly #scheduleIdleLeave: ScheduleIdleLeave;
  readonly #scheduleAloneLeave: ScheduleIdleLeave;
  #currentTrack: Track | null = null;
  #announce: ((text: string) => Promise<void>) | undefined;
  #ignoreIdle = false;
  #cancelIdleLeave: (() => void) | undefined;
  #cancelAloneLeave: (() => void) | undefined;

  constructor(input: CreateSessionInput) {
    this.engine = input.engine;
    this.#guildId = input.guildId;
    this.#voice = input.voice;
    this.#leavePolicy = input.leavePolicy ?? DEFAULT_LEAVE_POLICY;
    this.#scheduleIdleLeave =
      input.scheduleIdleLeave ?? defaultScheduleIdleLeave;
    this.#scheduleAloneLeave =
      input.scheduleAloneLeave ?? defaultScheduleIdleLeave;
    this.#voice.onIdle(() => {
      void this.#advanceOnIdleAsync();
    });
    this.#voice.onDisconnected(() => {
      this.#onVoiceDisconnected();
    });
  }

  /**
   * Current track, or `null` when idle. A paused track stays current.
   * @returns The track now playing or paused.
   */
  get currentTrack(): Track | null {
    return this.#currentTrack;
  }

  /**
   * Binds the announce sender used by the advance loop. Play door rebinds this.
   * @param send - Sends a channel message.
   */
  bindAnnounce(send: (text: string) => Promise<void>): void {
    this.#announce = send;
  }

  /**
   * Opens audio and plays immediately. First-track open failure throws and
   * does not set current or enqueue.
   * @param track - Track to play now.
   */
  async playNow(track: Track): Promise<void> {
    const audio: TrackAudio = await openOrWrapAsync(this.engine, track);
    this.#cancelScheduledIdleLeave();
    this.#ignoreIdle = false;
    await this.#voice.play(audio);
    this.#currentTrack = track;
  }

  /**
   * Enqueues a track and returns its display position (current occupies #1).
   * @param track - Track to queue.
   * @returns 1-based display position including the current track.
   */
  enqueue(track: Track): number {
    this.#queue.enqueue(track);
    return this.#queue.size + 1;
  }

  /**
   * Stops the player. Returns the skipped track, or `null` if nothing is current.
   * @returns The skipped track, or `null`.
   */
  skipCurrent(): Track | null {
    const skipped: Track | null = this.#currentTrack;
    if (skipped === null) {
      return null;
    }
    this.#voice.stop();
    return skipped;
  }

  /**
   * Current track plus upcoming queue copy.
   * @returns Snapshot of playback state.
   */
  snapshot(): SessionSnapshot {
    return {
      current: this.#currentTrack,
      upcoming: this.#queue.list(),
    };
  }

  /**
   * True when this guild is playing in a different voice channel than the invoker.
   * Paused still counts as occupied.
   * @param invokerVoiceChannelId - Invoker's voice channel id.
   * @returns Whether the session is occupied elsewhere.
   */
  isOccupiedInOtherChannel(invokerVoiceChannelId: string): boolean {
    if (this.#currentTrack === null) {
      return false;
    }
    const channelId: string | null = this.#voice.getChannelId();
    if (channelId === null) {
      return false;
    }
    return channelId !== invokerVoiceChannelId;
  }

  /**
   * Voice channel name used in occupied-channel replies.
   * @returns Channel name, or empty when unknown.
   */
  get voiceChannelName(): string {
    return this.#voice.getChannelName();
  }

  /**
   * Joins the invoker's channel, or moves only when idle.
   * @param channelId - Invoker's voice channel id.
   */
  async joinInvoker(channelId: string): Promise<void> {
    if (this.#shouldStayInCurrentChannel(channelId)) {
      return;
    }
    await this.#voice.join(channelId);
  }

  /**
   * @returns Whether the audio player is paused.
   */
  isPaused(): boolean {
    return this.#voice.isPaused();
  }

  /**
   * @returns Elapsed playback milliseconds from the voice player.
   */
  playbackDurationMs(): number {
    return this.#voice.playbackDurationMs();
  }

  /**
   * Pauses the current track. Does not advance the queue.
   * @returns Whether the player paused.
   */
  pause(): boolean {
    return this.#voice.pause();
  }

  /**
   * Resumes a paused track.
   * @returns Whether the player unpaused.
   */
  unpause(): boolean {
    return this.#voice.unpause();
  }

  /**
   * @returns Whether the bot is in a voice channel.
   */
  hasVoiceConnection(): boolean {
    return this.#voice.getChannelId() !== null;
  }

  /**
   * Voice channel id the bot is connected to, or `null` when not in voice.
   * @returns Channel snowflake, or `null`.
   */
  get voiceChannelId(): string | null {
    return this.#voice.getChannelId();
  }

  /**
   * Removes one upcoming track by 0-based index.
   * @param index - Position in the upcoming list.
   * @returns The removed track, or `null` if the index is out of range.
   */
  removeUpcomingAt(index: number): Track | null {
    return this.#queue.removeAt(index);
  }

  /**
   * Reorders upcoming tracks in place.
   */
  shuffleUpcoming(): void {
    this.#queue.shuffle();
  }

  /**
   * Drops every upcoming track. Does not stop the current track.
   * @returns Queue size before clear.
   */
  clearUpcoming(): number {
    const size: number = this.#queue.size;
    this.#queue.clear();
    return size;
  }

  /**
   * Stops the audio player only. Does not destroy the voice connection.
   */
  stopPlayer(): void {
    this.#voice.stop();
  }

  /**
   * Cancels idle and alone leave, deletes this session from the map, then
   * stops and destroys voice. Used by `dropSession`.
   */
  leaveNow(): void {
    this.#cancelScheduledLeaves();
    sessions.delete(this.#guildId);
    this.#voice.stop();
    this.#voice.destroy();
  }

  /**
   * Arms or cancels the alone-in-voice timer from a human listener count.
   * When `aloneTimeUntilStopMs` is `0`, this is a no-op. A count greater
   * than 0 cancels the timer. A count of 0 with a live voice connection
   * schedules `dropSession` after `aloneTimeUntilStopMs`. Firing sends
   * no extra message.
   * @param count - Non-bot members in the session voice channel.
   */
  noteHumanListenerCount(count: number): void {
    if (this.#leavePolicy.aloneTimeUntilStopMs === 0) {
      return;
    }
    if (count > 0) {
      this.#cancelScheduledAloneLeave();
      return;
    }
    if (!this.hasVoiceConnection()) {
      return;
    }
    this.#armAloneLeave();
  }

  #shouldStayInCurrentChannel(channelId: string): boolean {
    if (this.#currentTrack === null) {
      return false;
    }
    const currentId: string | null = this.#voice.getChannelId();
    return currentId !== null && currentId !== channelId;
  }

  #onVoiceDisconnected(): void {
    if (getSession(this.#guildId) === undefined) {
      return;
    }
    this.#cancelScheduledLeaves();
    this.#ignoreIdle = true;
    this.#voice.stop();
    this.#currentTrack = null;
  }

  async #advanceOnIdleAsync(): Promise<void> {
    if (getSession(this.#guildId) === undefined) {
      return;
    }
    if (this.#ignoreIdle) {
      return;
    }
    await this.#playNextFromQueueAsync();
  }

  async #playNextFromQueueAsync(): Promise<void> {
    const next: Track | null = this.#queue.dequeueNext();
    if (next === null) {
      this.#currentTrack = null;
      if (this.#voice.getChannelId() !== null) {
        this.#armIdleLeave();
      }
      return;
    }
    this.#cancelScheduledIdleLeave();
    const played: boolean = await this.#tryPlayNextAsync(next);
    if (!played) {
      await this.#playNextFromQueueAsync();
    }
  }

  async #tryPlayNextAsync(track: Track): Promise<boolean> {
    try {
      const audio: TrackAudio = await openOrWrapAsync(this.engine, track);
      await this.#voice.play(audio);
      this.#currentTrack = track;
      await this.#sendAnnounceAsync(nowPlayingText(track));
      return true;
    } catch {
      await this.#sendAnnounceAsync(`Skipping ${track.title}: couldn't play it`);
      return false;
    }
  }

  async #sendAnnounceAsync(text: string): Promise<void> {
    if (this.#announce === undefined) {
      return;
    }
    await this.#announce(text);
  }

  #armIdleLeave(): void {
    this.#cancelScheduledIdleLeave();
    if (this.#leavePolicy.stayInChannel) {
      return;
    }
    this.#cancelIdleLeave = this.#scheduleIdleLeave(() => {
      dropSession(this.#guildId);
    }, this.#leavePolicy.idleLeaveMs);
  }

  #armAloneLeave(): void {
    this.#cancelScheduledAloneLeave();
    this.#cancelAloneLeave = this.#scheduleAloneLeave(() => {
      dropSession(this.#guildId);
    }, this.#leavePolicy.aloneTimeUntilStopMs);
  }

  #cancelScheduledLeaves(): void {
    this.#cancelScheduledIdleLeave();
    this.#cancelScheduledAloneLeave();
  }

  #cancelScheduledIdleLeave(): void {
    if (this.#cancelIdleLeave === undefined) {
      return;
    }
    this.#cancelIdleLeave();
    this.#cancelIdleLeave = undefined;
  }

  #cancelScheduledAloneLeave(): void {
    if (this.#cancelAloneLeave === undefined) {
      return;
    }
    this.#cancelAloneLeave();
    this.#cancelAloneLeave = undefined;
  }
}

function defaultScheduleIdleLeave(
  callback: () => void,
  delayMs: number,
): () => void {
  const timer: ReturnType<typeof setTimeout> = setTimeout(callback, delayMs);
  return function cancelIdleLeave(): void {
    clearTimeout(timer);
  };
}

async function openOrWrapAsync(
  engine: EnginePort,
  track: Track,
): Promise<TrackAudio> {
  try {
    return await engine.openTrackAudio({ track });
  } catch (error) {
    if (error instanceof TrackResolveError) {
      throw error;
    }
    throw new TrackResolveError(openFailureMessage(error));
  }
}

function openFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Couldn't play that track.";
}

function nowPlayingText(track: Track): string {
  return `Now playing: ${track.title} (${formatDuration(track.durationSeconds)})`;
}
