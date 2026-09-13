import { printVsLavalink, runVsLavalinkAsync } from "./bench-lavalink/run.ts";

const report = await runVsLavalinkAsync(process.argv);
printVsLavalink(report);
