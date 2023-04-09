import { WebApi, getPersonalAccessTokenHandler } from "azure-devops-node-api";

export class ApiClient {
  private authHandler: ReturnType<typeof getPersonalAccessTokenHandler>;
  private connection: WebApi;

  constructor(
    accessToken: string,
    orgUrl: string,
    private projectName: string
  ) {
    this.authHandler = getPersonalAccessTokenHandler(accessToken);
    this.connection = new WebApi(orgUrl, this.authHandler);
  }

  async getLabels(prId: number) {
    try {
      const api = await this.connection.getGitApi();
      return await api.getPullRequest(this.projectName, prId);
    } catch (error) {
      new Error("Error: failed to get labels");
    }
  }
}
