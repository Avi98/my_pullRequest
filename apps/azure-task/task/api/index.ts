import { WebApi, getPersonalAccessTokenHandler } from "azure-devops-node-api";
import { BuildContextType, buildContext } from "../buildContext";
import { GitPullRequestCommentThread } from "azure-devops-node-api/interfaces/GitInterfaces";

export type Threads = GitPullRequestCommentThread;
export class ApiClient {
  constructor(private connection: WebApi, private buildCtx: BuildContextType) {}

  static async initializeApi() {
    if (!buildContext?.token) throw new Error("Token not found");

    const authHandler = getPersonalAccessTokenHandler(
      buildContext.token as string
    );
    const connection = new WebApi(buildContext.orgUrl, authHandler, {});
    await connection.connect();
    return new ApiClient(connection, buildContext);
  }

  async getLabels(repoId: string, prId: number) {
    try {
      if (!this.connection?.getGitApi) return;

      const api = await this.connection.getGitApi();
      return await api.getPullRequestLabels(repoId, prId);
    } catch (error) {
      throw new Error("API-ERROR: failed to get labels", { cause: error });
    }
  }

  async getAllThreads() {
    try {
      const api = await this.connection.getGitApi();
      return await api
        .getThreads(buildContext.repoId, Number(buildContext.prId))
        .then((res) => {
          return res
            .filter(
              (thread) =>
                !thread.comments?.[0].author?.displayName?.includes(
                  "Microsoft.VisualStudio.Services"
                )
            )
            .filter((comment) => !comment?.isDeleted);
        })
        .catch((e) => {
          throw e;
        });
    } catch (error) {
      throw new Error("API-ERROR: failed to get thread", { cause: error });
    }
  }

  async updateThreads() {
    try {
      const api = await this.connection.getGitApi();
      return;
    } catch (error) {
      throw new Error("API-ERROR: failed to update thread");
    }
  }
}
