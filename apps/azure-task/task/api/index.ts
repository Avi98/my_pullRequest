import { WebApi, getPersonalAccessTokenHandler } from "azure-devops-node-api";
import { BuildContext, buildContext } from "../buildContext";
export class ApiClient {
  constructor(private connection: WebApi, private buildCtx: BuildContext) {}

  static initializeApi() {
    if (!buildContext?.token) throw new Error("Token now found");

    const authHandler = getPersonalAccessTokenHandler(
      buildContext.token as string
    );
    const connection = new WebApi(buildContext.orgUrl, authHandler);
    return new ApiClient(connection, buildContext);
  }

  async getLabels(repoId: string, prId: number) {
    try {
      if (!this.connection?.getGitApi) return;

      const api = await this.connection.getGitApi();
      return await api.getPullRequestLabels(repoId, prId);
    } catch (error) {
      throw new Error("Error: failed to get labels", { cause: error });
    }
  }
}
