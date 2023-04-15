import { Instance, LunchServer } from "@pr/core";
import { ApiClient } from "./api";
import type { Threads } from "./api";
import { BuildContextType, buildContext } from "./buildContext";

class TriggerHandle {
  private shouldCommentLiveUrl: boolean;
  private TRIGGER_LABEL = "live-pr";

  constructor(
    private apiClient: ApiClient,
    private buildContext: BuildContextType,
    private instanceName: string,
    private ec2Starter: LunchServer,
    private ec2: Instance
  ) {
    this.shouldCommentLiveUrl = false;
  }

  static async createTrigger() {
    if (!buildContext.token) throw new Error("Token not found in trigger");

    const apiClient = await ApiClient.initializeApi();
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
      return allLabels.some((label) => label.name === this.TRIGGER_LABEL);
    return false;
  }

  async createLivePR() {
    if (!(await this.noInstanceFound())) {
      const gitUrl = this.buildContext.repoUrl;
      //Get clone link
      try {
        await this.ec2Starter.run(gitUrl);
        const liveLink = this.ec2.liveInstUrl;
        if (liveLink) {
          await this.createUpdateLivePrThread(liveLink);
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  async createUpdateLivePrThread(liveUrl: string) {
    try {
      const threads = await this.apiClient.getAllThreads();
      const livePrThread = this.livePrThread(threads);
      console.log({
        livePrThread,
        id: livePrThread?.comments?.[0].id,
        thead: livePrThread?.id,
      });

      if (
        threads &&
        !!livePrThread &&
        livePrThread?.comments?.[0].id &&
        livePrThread?.id
      ) {
        console.log("found live comment updating comment");
        await this.apiClient
          .updateComment({
            commentId: livePrThread.comments?.[0].id,
            message: `\n you can view your changes at ${liveUrl}`,
            threadId: livePrThread.id,
          })
          .catch((e) => {
            throw e;
          });
      } else {
        await this.apiClient
          .createComment(`\n you can view your changes at ${liveUrl}`)
          .catch((e) => {
            throw e;
          });
      }
    } catch (error) {
      throw error;
    }
  }

  private livePrThread(threads: Threads[]) {
    const hasCommentWithId = threads?.find((thread) =>
      thread.comments?.find((comment) =>
        comment?.content?.includes("live pr at")
      )
    );
    return hasCommentWithId;
  }

  private async noInstanceFound() {
    const hasInstance = await this.ec2.hasDuplicateInstance(this.instanceName);
    return hasInstance;
  }
}

export { TriggerHandle };
