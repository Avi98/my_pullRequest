import { TaskResult, setResult } from "azure-pipelines-task-lib";
import { TriggerHandle } from "./triggerHandle.js";
import { CleanUpLoseInstance } from "./cleanup/index.js";

const main = async () => {
  try {
    const trigger = await TriggerHandle.createTrigger();
    const hasLabel = await trigger.hasTriggerLabel();
    const shouldCleanUp = (await trigger.isPRMerged()) || !hasLabel;

    if (shouldCleanUp) {
      if (!hasLabel) {
        console.log(
          `No ${TriggerHandle.TRIGGER_LABEL} found cleaning up instance if any 🗑️ `
        );
      }
      return await trigger.cleanUp();
    }

    console.log(
      `Found ${TriggerHandle.TRIGGER_LABEL} creating the updated PR preview link 🚀 `
    );

    return await trigger.createLivePR();
  } catch (error: any) {
    console.error(error);
    setResult(TaskResult.Failed, error.message);
  }
};

main().finally(() => {
  //@TODO: clean dead pr instances
  new CleanUpLoseInstance().run();
});
