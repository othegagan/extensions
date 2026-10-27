import { Action, ActionPanel, Cache, Clipboard, Icon, Keyboard, List, open, showToast, Toast } from "@raycast/api";

import { getGitHubClient } from "../api/githubClient";
import { RevalidateList } from "../helpers";
import { getErrorMessage } from "../helpers/errors";
import { getPreviewUrlErrorMessage, getPreviewUrlFromRun } from "../helpers/workflow-preview-run";
import { WorkflowRunsResponse } from "../workflow-runs";

export type WorkflowRun = WorkflowRunsResponse["data"]["workflow_runs"][0];

const PREVIEW_WORKFLOW_NAME_HINTS = ["deployment", "feature branch"];
const previewUrlCache = new Cache({ namespace: "workflow-preview-urls" });

type WorkflowRunActionsProps = {
  workflowRun: WorkflowRun;
  repository: string;
  mutateList: RevalidateList;
};

export function WorkflowRunActions({ workflowRun, repository, mutateList }: WorkflowRunActionsProps) {
  const { octokit } = getGitHubClient();

  const [owner, repo] = repository.split("/");

  const canHavePreview = PREVIEW_WORKFLOW_NAME_HINTS.some((hint) =>
    (workflowRun.name ?? "").toLowerCase().includes(hint),
  );
  const previewUrlCacheKey = `${owner}/${repo}/${workflowRun.id}`;

  const commit = workflowRun.head_sha.slice(0, 7);
  const keywords: List.Item.Props["keywords"] = [workflowRun.head_sha];
  const accessories: List.Item.Accessory[] = [
    {
      text: commit,
      tooltip: `Author: ${workflowRun.head_commit?.author?.name ?? workflowRun.head_commit?.author?.email}`,
    },
  ];

  if (workflowRun.head_branch) {
    accessories.unshift({
      text: workflowRun.head_branch,
    });

    keywords.push(workflowRun.head_branch);
  }

  async function rerunWorkflow() {
    await showToast({ style: Toast.Style.Animated, title: "Sending re-run request" });

    try {
      await octokit.actions.reRunWorkflow({ run_id: workflowRun.id, owner, repo });

      await mutateList();

      await showToast({
        style: Toast.Style.Success,
        title: "Sent re-run request",
        message: "Refresh in 5-10 seconds.",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed sending re-run request",
        message: getErrorMessage(error),
      });
    }
  }

  async function rerunWorkflowFailedJobs() {
    await showToast({ style: Toast.Style.Animated, title: "Sending re-run workflow failed jobs request" });

    try {
      await octokit.actions.reRunWorkflowFailedJobs({ run_id: workflowRun.id, owner, repo });

      await mutateList();

      await showToast({
        style: Toast.Style.Success,
        title: "Sent re-run workflow failed jobs request",
        message: "Refresh in 5-10 seconds.",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed sending re-run workflow failed jobs request",
        message: getErrorMessage(error),
      });
    }
  }

  async function cancelRun() {
    await showToast({ style: Toast.Style.Animated, title: "Sending cancel request" });

    try {
      await octokit.actions.cancelWorkflowRun({ run_id: workflowRun.id, owner, repo });

      await mutateList();

      await showToast({
        style: Toast.Style.Success,
        title: "Sent cancel request",
        message: "Refresh in 10-15 seconds.",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed sending cancel request",
        message: getErrorMessage(error),
      });
    }
  }

  async function deleteRun() {
    await showToast({ style: Toast.Style.Animated, title: "Deleting Run" });

    try {
      await octokit.actions.deleteWorkflowRun({ run_id: workflowRun.id, owner, repo });

      await mutateList();

      await showToast({
        style: Toast.Style.Success,
        title: "Deleted run",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed deleting run",
        message: getErrorMessage(error),
      });
    }
  }

  async function withPreviewUrl(action: "open" | "copy") {
    await showToast({ style: Toast.Style.Animated, title: "Fetching preview URL…" });

    try {
      const cachedUrl = previewUrlCache.get(previewUrlCacheKey);
      const previewUrl = cachedUrl ?? (await getPreviewUrlFromRun(owner, repo, workflowRun.id));

      if (!previewUrl) {
        await showToast({
          style: Toast.Style.Failure,
          title: workflowRun.status === "completed" ? "No preview URL found" : "Preview not ready yet",
          message:
            workflowRun.status === "completed"
              ? "This run didn't publish a Vercel preview, or its logs have expired."
              : "The run is still in progress. Try again once the deploy job finishes.",
        });
        return;
      }

      if (!cachedUrl && workflowRun.status === "completed") {
        previewUrlCache.set(previewUrlCacheKey, previewUrl);
      }

      if (action === "open") {
        await open(previewUrl);
        await showToast({ style: Toast.Style.Success, title: "Opened preview URL" });
      } else {
        await Clipboard.copy(previewUrl);
        await showToast({ style: Toast.Style.Success, title: "Copied preview URL", message: previewUrl });
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed fetching preview URL",
        message: getPreviewUrlErrorMessage(error),
      });
    }
  }

  async function openPreviewUrl() {
    await withPreviewUrl("open");
  }

  async function copyPreviewUrl() {
    await withPreviewUrl("copy");
  }

  return (
    <ActionPanel title={commit}>
      <Action.OpenInBrowser url={workflowRun.html_url} />

      {canHavePreview ? (
        <Action
          title="Open Preview URL"
          icon={Icon.Globe}
          onAction={openPreviewUrl}
          shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
        />
      ) : null}

      {canHavePreview ? (
        <Action
          title="Copy Preview URL"
          icon={Icon.Clipboard}
          onAction={copyPreviewUrl}
          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
        />
      ) : null}

      {workflowRun.status === "completed" ? (
        <Action title="Rerun Workflow" icon={Icon.Clock} onAction={rerunWorkflow} />
      ) : null}

      {workflowRun.status === "completed" && workflowRun.conclusion !== "success" ? (
        <Action
          title="Rerun Workflow Failed Jobs"
          icon={Icon.Redo}
          onAction={rerunWorkflowFailedJobs}
          shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
        />
      ) : null}

      {workflowRun.status === "queued" || workflowRun.status === "in_progress" ? (
        <Action title="Cancel Run" icon={Icon.XMarkCircle} onAction={cancelRun} />
      ) : null}

      <Action
        icon={Icon.Trash}
        title="Delete Run"
        style={Action.Style.Destructive}
        onAction={deleteRun}
        shortcut={{ modifiers: ["ctrl"], key: "x" }}
      />

      <ActionPanel.Section>
        <Action
          icon={Icon.ArrowClockwise}
          title="Refresh"
          onAction={mutateList}
          shortcut={Keyboard.Shortcut.Common.Refresh}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
