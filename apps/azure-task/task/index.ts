import { TaskResult, setResult } from "azure-pipelines-task-lib";
import { TriggerHandle } from "./triggerHandle.js";
import { CleanUpLoseInstance } from "./cleanup/index.js";
import { env } from "./core/index.js";

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

if (env.isDev) {
  const core = await import("./core/index.js");
  const dotenv = await import("dotenv");

  dotenv.config();
  console.log({ env: process.env });

  const ec2 = new core.Instance({});
  const ec2Starter = new core.LunchServer(ec2);
  await ec2Starter
    .run(
      "https://9958703925dad@dev.azure.com/9958703925dad/bookshelf/_git/Next-docker"
    )
    .catch((e) => {
      console.error(e);
    });
} else {
  main().finally(() => {
    //@TODO: clean dead pr instances
    new CleanUpLoseInstance().run();
  });
}
