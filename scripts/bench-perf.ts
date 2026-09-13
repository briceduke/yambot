import { runEngineBench } from "../packages/audio-engine/src/bench/run.ts";
import { runBotBench } from "../packages/bot/src/bench/run.ts";

const n: number = readRepeatCount(process.argv);

const engine = await runEngineBench(n);
const bot = await runBotBench(n);

const report = {
  command: "bun run bench:perf",
  java: false,
  n,
  engine,
  bot,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write("\n");
process.stdout.write(markdownTable(report));
process.stdout.write("\n");

function readRepeatCount(argv: readonly string[]): number {
  const flagIndex: number = argv.indexOf("--n");
  if (flagIndex === -1) {
    return 10;
  }
  const raw: string | undefined = argv[flagIndex + 1];
  const parsed: number = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }
  return Math.floor(parsed);
}

function markdownTable(input: {
  readonly n: number;
  readonly engine: Awaited<ReturnType<typeof runEngineBench>>;
  readonly bot: Awaited<ReturnType<typeof runBotBench>>;
}): string {
  const lines: string[] = [
    `| Metric | p50 | p95 | n |`,
    `|---|---:|---:|---:|`,
    row(
      "resolve_ms youtube_url",
      input.engine.resolve_ms.youtube_url,
    ),
    row(
      "resolve_ms youtube_search",
      input.engine.resolve_ms.youtube_search,
    ),
    row(
      "resolve_ms soundcloud_url",
      input.engine.resolve_ms.soundcloud_url,
    ),
    row("open_audio_ms youtube", input.engine.open_audio_ms.youtube),
    row("open_audio_ms soundcloud", input.engine.open_audio_ms.soundcloud),
    row(
      "youtube_resolve_then_open_ms",
      input.engine.youtube_resolve_then_open_ms,
    ),
    row("playlist_enqueue_ms engine", input.engine.playlist_enqueue_ms),
    row("ttfa_ms", input.bot.ttfa_ms),
    row("skip_ms", input.bot.skip_ms),
    row("playlist_enqueue_ms bot queue", input.bot.playlist_enqueue_ms),
    `| rss_mb | ${input.engine.rss_mb} | | |`,
    `| heap_mb | ${input.engine.heap_mb} | | |`,
    `| cpu_pct | ${input.bot.cpu_pct ?? "n/a"} | | |`,
  ];
  return `${lines.join("\n")}\n`;
}

function row(
  name: string,
  summary: { readonly p50: number; readonly p95: number; readonly n: number },
): string {
  return `| ${name} | ${summary.p50} | ${summary.p95} | ${summary.n} |`;
}
