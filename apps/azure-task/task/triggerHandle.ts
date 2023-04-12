import { Instance, LunchServer } from "@pr/core";
import { ApiClient } from "./api";
import { BuildContext, buildContext } from "./buildContext";

const TRIGGER_LABEL = "live-pr";

class TriggerHandle {
  private shouldCommentLiveUrl: boolean;

  constructor(
    private apiClient: ApiClient,
    private buildContext: BuildContext,
    private instanceName: string,
    private ec2Starter: LunchServer,
    private ec2: Instance
  ) {
    this.shouldCommentLiveUrl = false;
  }

  static createTrigger() {
    if (!buildContext.token) throw new Error("Token not found in trigger");

    const apiClient = ApiClient.initializeApi();
    const ec2 = new Instance({});
    const ec2Starter = new LunchServer(ec2);

    return new TriggerHandle(
      apiClient,
      buildContext,
      String(buildContext.prId),
      ec2Starter,
      ec2
    );
  }

  async hasTriggerLabel() {
    const allLabels = await this.apiClient.getLabels(
      this.buildContext.repoId,
      Number(this.buildContext.prId)
    );
    if (allLabels?.length)
      return allLabels.some((label) => label.name === TRIGGER_LABEL);
    return false;
  }

  async createLivePR() {
    if (!(await this.noInstanceFound())) {
      const gitUrl = this.buildContext.repoUrl;
      //Get clone link
      try {
        console.log("create live link");
        await this.ec2Starter.run(gitUrl);
        const liveLink = this.ec2.liveInstUrl;
        if (liveLink) {
          //@TODO create comment with liveInsUrl
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  async createComment() {
    try {
      //TODO: check if comment
      console.log({ link: this.ec2.liveInstUrl });
    } catch (error) {}
  }

  private async noInstanceFound() {
    const hasInstance = await this.ec2.hasDuplicateInstance(this.instanceName);
    return hasInstance;
  }
}

export { TriggerHandle };
