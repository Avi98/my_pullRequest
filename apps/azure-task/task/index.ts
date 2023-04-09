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
      return trigger.createLivePR();
    } else {
      //no tags found
      // hasInstanceForPR();
      // removeUnusedInstance();
    }
  } catch (error: any) {
    console.log({ error });
    tl.setResult(tl.TaskResult.Failed, error.message);
  }
};

main();
