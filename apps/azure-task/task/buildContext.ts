import { join } from "path";
import { env } from "@pr/core";
import tl from "azure-pipelines-task-lib";

const isDev = env.isDev;
export const buildContext = {
  repoId:
    tl.getVariable("Build.Repository.ID") ||
    "a187c009-7402-429e-9111-a7791e589bed",
  prId: tl.getVariable("System.PullRequest.PullRequestId") || 46,
  token: env.pat || tl.getVariable("System.AccessToken"),
  orgUrl:
    tl.getVariable("System.CollectionUri") ||
    "https://dev.azure.com/9958703925dad",
  repoUrl:
    tl.getVariable("Build.Repository.URI") ||
    "https://9958703925dad@dev.azure.com/9958703925dad/bookshelf/_git/Next-docker",
  projectName: tl.getVariable("System.TeamProject") || "bookshelf",
  buildReason: tl.getVariable("Build.Reason") || "PullRequest",
  targetBranch: tl.getVariable("System.PullRequest.targetBranchName") || "",
  sourceBranch: tl.getVariable("System.PullRequest.SourceBranch") || "develop",
  clonePath: isDev
    ? join(process.cwd(), "../.dist/temp")
    : tl.getVariable("Agent.TempDirectory"),
  buildDirectory: tl.getVariable("Agent.BuildDirectory") || "",
} as const;

export type BuildContextType = typeof buildContext;
