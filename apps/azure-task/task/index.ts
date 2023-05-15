import { TaskResult, setResult } from "azure-pipelines-task-lib";
import { TriggerHandle } from "./triggerHandle.js";
import { CleanUpLoseInstance } from "./cleanup/index.js";
import { Instance, LunchServer, env } from "@pr/aws-core";
import { buildContext } from "./buildContext.js";

const main = async () => {
  try {
    const trigger = await TriggerHandle.createTrigger();
    const hasLabel = await trigger.hasTriggerLabel();
    const shouldCleanUp = (await trigger.isPRMerged()) || !hasLabel;

    if (shouldCleanUp) {
      if (!hasLabel) {
        console.log(
          `No ${TriggerHandle.TRIGGER_LABEL} found cleaning up instance if any 🗑️`
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
  const ec2 = new Instance({
    identityFilePath: buildContext.buildDirectory,
  });
  const ec2Starter = new LunchServer(ec2, buildContext);

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
