import { getGitHubClient } from "../api/githubClient";

import { getErrorMessage } from "./errors";
import { extractPreviewUrl } from "./workflow-preview";

const DEPLOY_JOB_NAME = "deploy_staging";
const VERCEL_STEP_HINT = "vercel";

function toLogText(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return "";
}

export async function getPreviewUrlFromRun(owner: string, repo: string, runId: number): Promise<string | undefined> {
  const { octokit } = getGitHubClient();

  const jobs = await octokit.paginate(octokit.actions.listJobsForWorkflowRun, {
    owner,
    repo,
    run_id: runId,
    per_page: 100,
  });

  const deployJob =
    jobs.find((job) => job.name === DEPLOY_JOB_NAME) ??
    jobs.find((job) => job.steps?.some((step) => step.name.toLowerCase().includes(VERCEL_STEP_HINT)));

  if (!deployJob) {
    return undefined;
  }

  const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs", {
    owner,
    repo,
    job_id: deployJob.id,
    request: { redirect: "follow" },
  });

  return extractPreviewUrl(toLogText(data));
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

export function getPreviewUrlErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);

  if (status === 403) {
    return "Your GitHub token can't read workflow logs. Add the `repo` scope to a classic token, or Actions: Read to a fine-grained token.";
  }

  if (status === 404) {
    return "Workflow logs aren't available. GitHub deletes them after 90 days, and running jobs may not have logs yet.";
  }

  return getErrorMessage(error);
}
