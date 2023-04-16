import tl from "azure-pipelines-task-lib/task";
import { TriggerHandle } from "./triggerHandle";
import { CleanUpLoseInstance } from "./cleanup";

const main = async () => {
  try {
    const trigger = await TriggerHandle.createTrigger();
    const hasLabel = await trigger.hasTriggerLabel();
    const shouldCleanUp = (await trigger.isPRMerged()) || !hasLabel;

    if (shouldCleanUp) {
      return await trigger.cleanUp();
    }

    return await trigger.createLivePR();
  } catch (error: any) {
    tl.setResult(tl.TaskResult.Failed, error.message);
  }
};

main().finally(() => {
  //@TODO: clean dead pr instances
  new CleanUpLoseInstance().run();
});
