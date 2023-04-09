import * as azdev from "azure-devops-node-api";
import tl from "azure-pipelines-task-lib/task";
import { Instance, LunchServer, env } from "@pr/core";
import { ApiClient } from "./api";

/**
 * get all labels using Azure API
 *
 */
const main = async () => {
  try {
    const apiClient = new ApiClient(env.pat, "url", "projectName");
    const allTags = await apiClient.getLabels(12);
    console.log({ allTags });
  } catch (error: any) {
    console.log({ error });
    tl.setResult(tl.TaskResult.Failed, error.message);
  }
};

main();
