export interface PrefixParseInput {
  readonly content: string;
  readonly prefix: string;
  readonly isBot: boolean;
  readonly inGuild: boolean;
}

export interface ParsedPrefixCommand {
  readonly name: string;
  readonly args: string;
}

/**
 * Parses a prefix command from a message. Returns `null` for bots, DMs, and
 * content that does not start with the prefix. Unknown names are still returned.
 * @param input - Message fields used to parse the command.
 * @returns Command name and args, or `null` when the message is not a command.
 */
export function parsePrefixMessage(
  input: PrefixParseInput,
): ParsedPrefixCommand | null {
  if (input.isBot || !input.inGuild) {
    return null;
  }
  if (!input.content.startsWith(input.prefix)) {
    return null;
  }
  const afterPrefix: string = input.content.slice(input.prefix.length).trim();
  if (afterPrefix.length === 0) {
    return null;
  }
  return splitNameAndArgs(afterPrefix);
}

/**
 * Reads `COMMAND_PREFIX` from env, defaulting to `!`.
 * @param env - Process environment.
 * @returns Prefix string.
 */
export function readCommandPrefix(env: NodeJS.ProcessEnv): string {
  const prefix: string | undefined = env["COMMAND_PREFIX"];
  if (prefix === undefined || prefix.length === 0) {
    return "!";
  }
  return prefix;
}

function splitNameAndArgs(afterPrefix: string): ParsedPrefixCommand {
  const spaceIndex: number = afterPrefix.search(/\s/);
  if (spaceIndex === -1) {
    return { name: afterPrefix.toLowerCase(), args: "" };
  }
  const name: string = afterPrefix.slice(0, spaceIndex).toLowerCase();
  const args: string = afterPrefix.slice(spaceIndex).trim();
  return { name, args };
}
