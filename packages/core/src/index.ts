import dotenv from "dotenv";
import { Instance } from "./instance";
import { LunchServer } from "./launchServer";

dotenv.config();

const main = async () => {
  const ec2 = new Instance({ region: "us-east-1" });
  const serverUp = new LunchServer(ec2);

  await serverUp.run(
    "https://9958703925dad@dev.azure.com/9958703925dad/bookshelf/_git/Next-docker"
  );
};
main();
