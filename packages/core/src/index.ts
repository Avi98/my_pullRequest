import { EC2Client } from "@aws-sdk/client-ec2";
import { Instance } from "./instance";
import { LunchServer } from "./launchServer";
/**
 * Prototype
 *
 * 1. create ec2 instance
 * 2. pull code from git repo
 * 3. start docker, build docker images, run docker container
 * 4. clean docker images
 * 5. clean ec2 instance
 */

console.log("mau");
const main = async () => {
  // const n = Instance.createInstance({
  //   defaultPort: 300,
  //   dns: "",
  //   instanceType: "is",
  // });

  const serverUp = new LunchServer();
  await serverUp.run("https://github.com/itsjavi/turborepo-react-next.git");
};
main();
