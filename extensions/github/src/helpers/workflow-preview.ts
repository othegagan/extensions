const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
const LEADING_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+/gm;
const PREVIEW_LINE_PATTERN = /Preview:?\s+(https:\/\/[^\s]+\.vercel\.app)/i;
const VERCEL_URL_PATTERN = /https:\/\/[^\s]+\.vercel\.app/;

export function extractPreviewUrl(logText: string): string | undefined {
  const cleanedLog = logText.replace(ANSI_ESCAPE_PATTERN, "").replace(LEADING_TIMESTAMP_PATTERN, "");

  return cleanedLog.match(PREVIEW_LINE_PATTERN)?.[1] ?? cleanedLog.match(VERCEL_URL_PATTERN)?.[0];
}
