import { TaskResult, setResult } from "azure-pipelines-task-lib";
import { TriggerHandle } from "./triggerHandle.js";
import { CleanUpLoseInstance } from "./cleanup/index.js";

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
    setResult(TaskResult.Failed, error.message);
  }
};

main().finally(() => {
  //@TODO: clean dead pr instances
  new CleanUpLoseInstance().run();
});
