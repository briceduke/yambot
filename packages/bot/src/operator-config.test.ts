import { afterEach, describe, expect, test } from "bun:test";

import {
  canUseDjCommands,
  clearAllOverlays,
  clearGuildOverlayPrefix,
  getGuildOperatorView,
  readOperatorEnv,
  setGuildOverlayDjRoleId,
  setGuildOverlayPrefix,
  setGuildOverlayTextChannelId,
  setGuildOverlayVoiceChannelId,
} from "./operator-config.ts";

const GUILD_ID = "guild-1";

afterEach(() => {
  clearAllOverlays();
});

describe("readOperatorEnv", () => {
  test("uses defaults when keys are missing", () => {
    expect(readOperatorEnv({})).toEqual({
      commandPrefix: "!",
      djRoleId: null,
      stayInChannel: false,
      aloneTimeUntilStopSeconds: 0,
      idleLeaveSeconds: 300,
    });
  });

  test("reads COMMAND_PREFIX and defaults empty to !", () => {
    expect(readOperatorEnv({ COMMAND_PREFIX: "?" }).commandPrefix).toBe("?");
    expect(readOperatorEnv({ COMMAND_PREFIX: "" }).commandPrefix).toBe("!");
  });

  test("reads DJ_ROLE_ID and treats missing or empty as null", () => {
    expect(readOperatorEnv({ DJ_ROLE_ID: "role-1" }).djRoleId).toBe("role-1");
    expect(readOperatorEnv({ DJ_ROLE_ID: "" }).djRoleId).toBeNull();
    expect(readOperatorEnv({}).djRoleId).toBeNull();
  });

  test("reads STAY_IN_CHANNEL true for true, 1, and yes, case-insensitive", () => {
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "true" }).stayInChannel).toBe(
      true,
    );
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "TRUE" }).stayInChannel).toBe(
      true,
    );
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "1" }).stayInChannel).toBe(true);
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "yes" }).stayInChannel).toBe(
      true,
    );
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "Yes" }).stayInChannel).toBe(
      true,
    );
  });

  test("reads STAY_IN_CHANNEL false for other values", () => {
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "false" }).stayInChannel).toBe(
      false,
    );
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "0" }).stayInChannel).toBe(false);
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "no" }).stayInChannel).toBe(
      false,
    );
    expect(readOperatorEnv({ STAY_IN_CHANNEL: "" }).stayInChannel).toBe(false);
  });

  test("reads ALONE_TIME_UNTIL_STOP integer seconds and maps missing, non-integer, or ≤0 to 0", () => {
    expect(
      readOperatorEnv({ ALONE_TIME_UNTIL_STOP: "45" }).aloneTimeUntilStopSeconds,
    ).toBe(45);
    expect(readOperatorEnv({}).aloneTimeUntilStopSeconds).toBe(0);
    expect(
      readOperatorEnv({ ALONE_TIME_UNTIL_STOP: "abc" })
        .aloneTimeUntilStopSeconds,
    ).toBe(0);
    expect(
      readOperatorEnv({ ALONE_TIME_UNTIL_STOP: "1.5" })
        .aloneTimeUntilStopSeconds,
    ).toBe(0);
    expect(
      readOperatorEnv({ ALONE_TIME_UNTIL_STOP: "0" }).aloneTimeUntilStopSeconds,
    ).toBe(0);
    expect(
      readOperatorEnv({ ALONE_TIME_UNTIL_STOP: "-3" })
        .aloneTimeUntilStopSeconds,
    ).toBe(0);
  });

  test("reads IDLE_LEAVE_SECONDS with missing or non-integer as 300, negative as 300, and 0 allowed", () => {
    expect(readOperatorEnv({}).idleLeaveSeconds).toBe(300);
    expect(readOperatorEnv({ IDLE_LEAVE_SECONDS: "60" }).idleLeaveSeconds).toBe(
      60,
    );
    expect(
      readOperatorEnv({ IDLE_LEAVE_SECONDS: "abc" }).idleLeaveSeconds,
    ).toBe(300);
    expect(
      readOperatorEnv({ IDLE_LEAVE_SECONDS: "1.5" }).idleLeaveSeconds,
    ).toBe(300);
    expect(readOperatorEnv({ IDLE_LEAVE_SECONDS: "-1" }).idleLeaveSeconds).toBe(
      300,
    );
    expect(readOperatorEnv({ IDLE_LEAVE_SECONDS: "0" }).idleLeaveSeconds).toBe(
      0,
    );
  });
});

describe("getGuildOperatorView", () => {
  test("falls through to env when overlay fields are missing", () => {
    const env: NodeJS.ProcessEnv = {
      COMMAND_PREFIX: "?",
      DJ_ROLE_ID: "env-role",
      STAY_IN_CHANNEL: "yes",
      ALONE_TIME_UNTIL_STOP: "12",
      IDLE_LEAVE_SECONDS: "90",
    };
    expect(getGuildOperatorView(GUILD_ID, env)).toEqual({
      prefix: "?",
      djRoleId: "env-role",
      textChannelId: null,
      voiceChannelId: null,
      stayInChannel: true,
      aloneTimeUntilStopSeconds: 12,
      idleLeaveSeconds: 90,
    });
  });

  test("merges overlay over env, including explicit null DJ role", () => {
    const env: NodeJS.ProcessEnv = {
      COMMAND_PREFIX: "?",
      DJ_ROLE_ID: "env-role",
    };
    setGuildOverlayPrefix(GUILD_ID, "!!");
    setGuildOverlayDjRoleId(GUILD_ID, null);
    setGuildOverlayTextChannelId(GUILD_ID, "text-1");
    setGuildOverlayVoiceChannelId(GUILD_ID, "voice-1");
    expect(getGuildOperatorView(GUILD_ID, env)).toEqual({
      prefix: "!!",
      djRoleId: null,
      textChannelId: "text-1",
      voiceChannelId: "voice-1",
      stayInChannel: false,
      aloneTimeUntilStopSeconds: 0,
      idleLeaveSeconds: 300,
    });
  });

  test("keeps env prefix and DJ role when a different overlay field is set", () => {
    const env: NodeJS.ProcessEnv = {
      COMMAND_PREFIX: "?",
      DJ_ROLE_ID: "env-role",
    };
    setGuildOverlayTextChannelId(GUILD_ID, "text-1");
    const view = getGuildOperatorView(GUILD_ID, env);
    expect(view.prefix).toBe("?");
    expect(view.djRoleId).toBe("env-role");
    expect(view.textChannelId).toBe("text-1");
  });

  test("restores env prefix after the prefix overlay is cleared", () => {
    const env: NodeJS.ProcessEnv = { COMMAND_PREFIX: "?" };
    setGuildOverlayPrefix(GUILD_ID, "!!");
    expect(getGuildOperatorView(GUILD_ID, env).prefix).toBe("!!");
    clearGuildOverlayPrefix(GUILD_ID);
    expect(getGuildOperatorView(GUILD_ID, env).prefix).toBe("?");
  });

  test("does not leak overlay between guilds", () => {
    setGuildOverlayPrefix(GUILD_ID, "!!");
    expect(getGuildOperatorView("guild-2", { COMMAND_PREFIX: "?" }).prefix).toBe(
      "?",
    );
  });
});

describe("canUseDjCommands", () => {
  test("returns true when the DJ role is unset", () => {
    expect(
      canUseDjCommands({
        djRoleId: null,
        invokerIsAdmin: false,
        invokerRoleIds: [],
      }),
    ).toBe(true);
  });

  test("returns true when the invoker has the DJ role", () => {
    expect(
      canUseDjCommands({
        djRoleId: "dj-role",
        invokerIsAdmin: false,
        invokerRoleIds: ["other", "dj-role"],
      }),
    ).toBe(true);
  });

  test("returns true when the invoker is admin even without the DJ role", () => {
    expect(
      canUseDjCommands({
        djRoleId: "dj-role",
        invokerIsAdmin: true,
        invokerRoleIds: [],
      }),
    ).toBe(true);
  });

  test("returns false when a DJ role is set, the invoker is not admin, and the role is missing", () => {
    expect(
      canUseDjCommands({
        djRoleId: "dj-role",
        invokerIsAdmin: false,
        invokerRoleIds: ["other"],
      }),
    ).toBe(false);
  });
});
