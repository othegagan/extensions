import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

type ExtractPreviewUrl = (logText: string) => string | undefined;

async function loadExtractPreviewUrl(): Promise<ExtractPreviewUrl> {
  const moduleUrl = pathToFileURL(resolve("src/helpers/workflow-preview.ts")).href;
  const module = (await import(moduleUrl)) as { extractPreviewUrl: ExtractPreviewUrl };
  return module.extractPreviewUrl;
}

const ESCAPE = "\u001b";

test("extracts the preview URL from timestamped logs containing ANSI codes", async () => {
  const extractPreviewUrl = await loadExtractPreviewUrl();

  const log = [
    `2026-10-27T10:15:28.1234567Z ${ESCAPE}[33mInspect: https://vercel.com/astra/dash-web/BDSGvdxnLAxgkXz9NPCmZAQ3mVJj${ESCAPE}[0m`,
    `2026-10-27T10:15:30.1234567Z ${ESCAPE}[32mPreview: https://dash-gotott03y-astra.vercel.app${ESCAPE}[0m`,
    "2026-10-27T10:15:31.1234567Z To deploy again: npx vercel --prebuilt",
  ].join("\n");

  assert.equal(extractPreviewUrl(log), "https://dash-gotott03y-astra.vercel.app");
});

test("prefers the Preview line over other Vercel URLs", async () => {
  const extractPreviewUrl = await loadExtractPreviewUrl();

  const log = [
    "2026-10-27T10:15:25.0000001Z Aliased: https://dash-old-astra.vercel.app",
    "2026-10-27T10:15:30.1234567Z Preview: https://dash-gotott03y-astra.vercel.app",
    "2026-10-27T10:15:31.1234567Z Next steps: open https://dash-other-astra.vercel.app",
  ].join("\n");

  assert.equal(extractPreviewUrl(log), "https://dash-gotott03y-astra.vercel.app");
});

test("falls back to the first Vercel URL when there is no Preview line", async () => {
  const extractPreviewUrl = await loadExtractPreviewUrl();

  const log = [
    "2026-10-27T10:15:28.1234567Z Inspect: https://vercel.com/astra/dash-web/abc",
    "2026-10-27T10:15:30.1234567Z Deployed to https://dash-abc-astra.vercel.app",
  ].join("\n");

  assert.equal(extractPreviewUrl(log), "https://dash-abc-astra.vercel.app");
});

test("returns undefined when the log has no Vercel preview URL", async () => {
  const extractPreviewUrl = await loadExtractPreviewUrl();

  const log = [
    "2026-10-27T10:15:28.1234567Z Inspect: https://vercel.com/astra/dash-web/abc",
    "2026-10-27T10:15:29.1234567Z Deploy finished.",
  ].join("\n");

  assert.equal(extractPreviewUrl(log), undefined);
});
