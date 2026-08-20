/**
 * Formats a duration for command replies: `m:ss` under one hour, `h:mm:ss` at
 * one hour and over.
 * @param durationSeconds - Length in seconds.
 * @returns Display string such as `3:33` or `1:01:01`.
 */
export function formatDuration(durationSeconds: number): string {
  const totalSeconds: number = Math.max(0, Math.floor(durationSeconds));
  const hours: number = Math.floor(totalSeconds / 3600);
  const minutes: number = Math.floor((totalSeconds % 3600) / 60);
  const seconds: number = totalSeconds % 60;
  const paddedSeconds: string = padTwoDigits(seconds);
  if (hours === 0) {
    return `${minutes}:${paddedSeconds}`;
  }
  return `${hours}:${padTwoDigits(minutes)}:${paddedSeconds}`;
}

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}
