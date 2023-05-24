import { TaskResult, setResult } from "azure-pipelines-task-lib";
import { TriggerHandle } from "./triggerHandle.js";
import { CleanUpLoseInstance } from "./cleanup/index.js";
import { Instance, LunchServer, env } from "@pr/aws-core";
import { buildContext } from "./buildContext.js";

const main = async () => {
  try {
    const trigger = await TriggerHandle.create();
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

if (env.isDev && env.git?.remote_url) {
  const ec2 = new Instance({
    identityFilePath: buildContext.defaultPrivatePath,
    sshPrivateKey: env.sshKeys.privateKey,
    securityGroupId: env.securityId,
    securityGroupName: env.securityGroup,
    imageId: env.imageId || "ami-02f3f602d23f1659d",
    imageType: env.imageType || "t2.micro",
    region: env?.region || "us-east-1",
  });
  const ec2Starter = new LunchServer(ec2, buildContext);

  await ec2Starter.run(env.git.remote_url).catch((e) => {
    console.error(e);
  });
} else {
  main().finally(() => {
    //@TODO: clean dead pr instances
    new CleanUpLoseInstance().run();
  });
}
