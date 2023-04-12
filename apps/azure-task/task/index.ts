import tl from "azure-pipelines-task-lib/task";
import { TriggerHandle } from "./triggerHandle";

/**
 * get all labels using Azure API
 *
 */
const main = async () => {
  try {
    const trigger = TriggerHandle.createTrigger();
    if (await trigger.hasTriggerLabel()) {
      return await trigger.createLivePR();
    } else {
      //no tags found
      // hasInstanceForPR();
      // removeUnusedInstance();
    }
  } catch (error: any) {
    console.error({ error });
    tl.setResult(tl.TaskResult.Failed, error.message);
  }
};

main();
