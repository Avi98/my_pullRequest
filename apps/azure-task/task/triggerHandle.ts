import { ApiClient } from "./api";
import { BuildContext, buildContext } from "./buildContext";

const TRIGGER_LABEL = "live-pr";

class TriggerHandle {
  constructor(
    private apiClient: ApiClient,
    private buildContext: BuildContext
  ) {}

  static createTrigger() {
    if (!buildContext.token) throw new Error("Token not found in trigger");

    const apiClient = ApiClient.initializeApi();
    return new TriggerHandle(apiClient, buildContext);
  }

  async hasTriggerLabel() {
    const allLabels = await this.apiClient.getLabels(
      this.buildContext.repoId,
      Number(this.buildContext.prId)
    );
    console.log({ allLabels });
    if (allLabels?.length)
      return allLabels.some((label) => label.name === TRIGGER_LABEL);
    return false;
  }
}

export { TriggerHandle };
