import { join } from "path";
import { env } from "@pr/aws-core";
import tl from "azure-pipelines-task-lib";

const isDev = env.isDev;

const dummyGitContext: BuildContextType = {
  repoId: "a187c009-7402-429e-9111-a7791e589bed",
  prId: "46",
  token: env.pat!,
  orgUrl: "https://dev.azure.com/9958703925dad",
  repoUrl:
    "https://9958703925dad@dev.azure.com/9958703925dad/bookshelf/_git/Next-docker",
  projectName: "bookshelf",
  buildReason: "PullRequest",
  targetBranch: "",
  sourceBranch: "develop",
  clonePath: join(process.cwd(), "../.dist/temp"),
  buildDirectory: "",
};

const azureGitContext = {
  repoId: getVariable("Build.Repository.ID"),
  prId: getVariable("System.PullRequest.PullRequestId"),
  token: env.pat || getVariable("System.AccessToken"),
  orgUrl: getVariable("System.CollectionUri"),
  repoUrl: getVariable("Build.Repository.URI"),

  projectName: getVariable("System.TeamProject"),
  buildReason: getVariable("Build.Reason"),
  targetBranch: getVariable("System.PullRequest.targetBranchName"),
  sourceBranch: getVariable("System.PullRequest.SourceBranch"),
  clonePath: getVariable("Agent.TempDirectory"),
  buildDirectory: getVariable("Agent.BuildDirectory"),
} as const;

function getVariable(variableName: string) {
  const value = tl.getVariable(variableName);
  if (!value) throw new Error(`TaskVariable not found ${variableName}`);

  return value;
}

export const buildContext = isDev ? dummyGitContext : azureGitContext;

export type BuildContextType = Record<keyof typeof azureGitContext, string>;
