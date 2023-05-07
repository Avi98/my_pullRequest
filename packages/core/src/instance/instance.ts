import { EC2Client, InstanceStateName } from "@aws-sdk/client-ec2";
import { $, execa } from "execa";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { env } from "../utils/env.js";
import { InstanceCmdFactories } from "./instanceFactories.js";
import { polling, createPrivateIdentity } from "./utils.js";
import { fileURLToPath } from "url";
import { buildContext } from "../launchServer/launchServer.js";

type InstanceConfigType = {
  region?: string;
  sshPrivateKey?: string;
};

type LaunchInstanceConfig = {
  name: string;
  sshPublicKey: string;
  instanceType?: string;
  imageId?: string;
  imageType?: string;
  securityGroupId: string;
  securityGroupName: string;
  keyName: string;
};

type InitializeInstance = {
  name: string | null;
  awsUrl: string | null;
  id: string | null;
  ip: string | null;
};
interface IInstance {
  launch: (config: LaunchInstanceConfig) => void;
}
export class Instance implements IInstance {
  private client: EC2Client;
  private launchedInstanceId: string | null;
  private instanceName: string | null;
  private semaphore: string;
  private privateKey: string;
  private publicDns: string | null;
  private liveUrl: string | null;
  private cmd: typeof InstanceCmdFactories;

  static privateIdentityFile = join(
    `${buildContext.buildDirectory}`,
    "private"
  );

  constructor({
    region = "us-east-1",
    sshPrivateKey = env.sshKeys.privateKey,
  }: InstanceConfigType) {
    this.cmd = InstanceCmdFactories;

    this.semaphore = "/etc/prbranch/ready";
    this.launchedInstanceId = null;
    this.instanceName = null;
    this.publicDns = null;
    this.privateKey = sshPrivateKey;
    this.liveUrl = null;

    this.client = InstanceCmdFactories.createInstance({
      region,
    });
  }

  /**
   * checks if the instance already exsits.
   * if not exits create new instance should be created
   *
   * @TODO ami_id gets changed frequently need to find dynamic ami-id.
   * @param instanceConfig
   */
  async launch(instanceConfig: LaunchInstanceConfig) {
    const {
      name,
      imageId = "ami-02f3f602d23f1659d",
      imageType = "t2.micro",
      securityGroupId,
      securityGroupName,
      keyName,
    } = instanceConfig;
    try {
      if (await this.hasDuplicateInstance(name)) {
        //@TODO: clean previous running docker images
        console.log("Instance already running for this PR 🏃");

        //stop already running docker container
        await this.stopDockerContainer();
        return;
      }

      console.log("No running instance found, creating new instance");
      const userData = [
        `#!/bin/bash
        yum install -y docker`,
        "usermod -aG docker ec2-user",
        "service docker start",
        "echo 'docker image prune -a --filter=\"until=96h\" --force' > /etc/cron.daily/docker-prune && chmod a+x /etc/cron.daily/docker-prune",
        "mkdir -p /etc/prbranch/app && touch /etc/prbranch/ready && chown -R ec2-user:ec2-user /etc/prbranch",
      ].join(" && ");

      const bufferString = Buffer.from(userData).toString("base64");

      await this.client
        .send(
          //imageid changes frequently need to have dynamic image id
          this.cmd.runInstance({
            MaxCount: 1,
            MinCount: 1,
            UserData: bufferString,
            ImageId: imageId,
            InstanceType: imageType,
            SecurityGroupIds: [securityGroupId],
            SecurityGroups: [securityGroupName],
            KeyName: keyName,
            TagSpecifications: [
              {
                ResourceType: "instance",
                Tags: [
                  {
                    Key: "Name",
                    Value: name,
                  },
                ],
              },
            ],
          })
        )
        .then((instance) => {
          console.log(
            `instance launched with id ${instance.Instances?.at(0)?.InstanceId}`
          );

          const launchedInstance = instance.Instances?.at(0) || null;
          console.log(
            `instance state ${launchedInstance?.State?.Name} for InstanceName: ${name}, publicIp: ${launchedInstance?.PublicIpAddress} `
          );
          this.updateInstanceState({
            awsUrl: launchedInstance?.PublicDnsName || null,
            id: launchedInstance?.InstanceId || null,
            name: instanceConfig.name || null,
            ip: launchedInstance?.PublicIpAddress || null,
          });

          return instance.Instances?.at(0)?.InstanceId;
        })
        .catch((e) => {
          throw e;
        });
    } catch (error) {
      throw new Error(`${instanceConfig.name} lunch error`, { cause: error });
    }
  }

  async deleteInstance(instanceId: string | string[]) {
    if (!instanceId) throw new Error("Delete instance requires instance Id");

    const ids = Array.isArray(instanceId) ? instanceId : [instanceId];
    try {
      return await this.client.send(
        InstanceCmdFactories.deleteInstance({
          InstanceIds: ids,
        })
      );
    } catch (error) {
      throw new Error("Unable to delete instance");
    }
  }

  // stop docker
  private async stopDockerContainer() {
    //node thinks one backslash as escape
    await this.ssh(`docker stop \\$(docker ps -aq)`);
    await this.ssh(`docker rm \\$(docker ps -aq)`);
    await this.ssh(`docker rmi \\$(docker images -q)`);
  }

  async waitUntilInstance() {
    const instanceName = this.instanceName;
    if (
      instanceName &&
      (await polling({
        cb: async () => await this.hasDuplicateInstance(instanceName),
      }))
    ) {
      return true;
    } else if (!instanceName) {
      throw new Error("Instance Name not found");
    }
    throw new Error("Instance timeout aborting instance creation");
  }

  verifySshConnection = async () => {
    let sshConnected = false;
    await this.ssh(`test -f ${this.semaphore}`)
      .then(() => {
        return (sshConnected = true);
      })
      .catch(() => {
        sshConnected = false;
      });
    return sshConnected;
  };

  async cpyTarOnInstance(sourcePath: string, serverAppPath: string) {
    //scp tmp files to /tmp/app

    if (!sourcePath && !serverAppPath)
      throw new Error("Source or Server path for app not provided");

    try {
      console.log("cpy....");
      await this.scp({
        source: sourcePath,
        target: serverAppPath,
        mode: "0600",
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async mvStartScriptToServer() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const currentDir = __dirname;
      const startScriptPath = "../uploadScript/upload.sh";

      const startScript = join(currentDir, startScriptPath);

      if (!existsSync(startScript))
        throw new Error("Docker Start script not found");
      await this.scp({ source: startScript, target: "/etc/prbranch" });
      //@TODO change the dockerimage tag based on the pullRequest and commit sha
      await this.ssh(`cd /etc/prbranch && sh upload.sh -a /app -g pullpreview`);
    } catch (error) {
      throw new Error("Failed to cpy startUp script to instance", {
        cause: error,
      });
    }
  }

  get liveInstUrl() {
    return this.liveUrl;
  }

  private async scp({
    source,
    target,
    fileName,
    mode = "0600",
  }: {
    source: string;
    target: string;
    fileName?: string;
    mode?: string;
  }) {
    const host = this.publicDns;
    const remoteUser = "ec2-user";
    const tempPrivateKey = Instance.privateIdentityFile;

    await createPrivateIdentity(tempPrivateKey, this.privateKey);

    console.log("Starting to cpy files to server 📁 ---> 📂");

    await execa(
      "scp",
      [
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "LogLevel=ERROR",
        "-r",
        `-i`,
        `${tempPrivateKey}`,
        `${source}`,
        `${remoteUser}@${host}:${target}`,
      ],
      {
        env: {
          ...process.env,
          NODE_DEBUG: "child_process",
        },
        verbose: true,
        shell: true,
      }
    )
      .then((res) => {
        if (res.exitCode === 0) console.log("done writing the files ✅");
      })
      .catch((e) => {
        throw e;
      });
  }

  private async ssh(cmd: string, file?: string, debug = false) {
    const publicDns = this.publicDns;
    const privateKey = this.privateKey;
    const sshAddress = `ec2-user@${publicDns}`;
    const tempPrivateKey = Instance.privateIdentityFile;
    await createPrivateIdentity(tempPrivateKey, privateKey);

    const cmdToRun = `ssh ${
      debug ? "-vvv" : ""
    } -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 -i "${tempPrivateKey}" "${sshAddress}" "${cmd}"`;

    const cpyFile = `cat ${file} | ${cmdToRun}`;
    console.log(`\n running cmd..`);
    console.log(`${file ? cpyFile : cmdToRun}\n`);

    if (file) {
      return await $({ verbose: true })`${cpyFile}`
        .then((_) => {
          console.log(`\n successfully ran this cmd ${cpyFile} \n`);
        })
        .catch((e) => {
          console.error(e);
          throw new Error("Error while logging the cmd with file ", {
            cause: e,
          });
        });
    } else {
      return await $({ verbose: true, shell: true })`${cmdToRun}`
        .then((_) => {
          console.log(`\n successfully ran this cmd ${cmdToRun} \n`);
        })
        .catch((e) => {
          console.error(e);
          throw new Error("Error while logging the cmd", { cause: e });
        });
    }
  }

  private updateInstanceState(currentInstance: InitializeInstance) {
    this.instanceName = currentInstance.name;
    this.launchedInstanceId = currentInstance.id;
    this.publicDns = currentInstance.awsUrl;
    //change this once the dns is setup
    this.liveUrl = `http://${currentInstance.ip}:3000`;
  }

  hasDuplicateInstance = async (name: string) => {
    let isRunning = false;
    const instanceId = this.launchedInstanceId;
    try {
      await this.getInstanceInfo({ id: instanceId || undefined, name })
        .then((res) => {
          console.log("Get instance res");
          res?.forEach((inst) => {
            const instanceNameTag = inst?.Tags?.filter(
              (tag) => tag.Value === name
            )[0];

            //dns gets assigned only when the instance is live, so need to make sure instance is live
            if (
              inst?.PublicDnsName &&
              inst.InstanceId &&
              instanceNameTag?.Value
            ) {
              console.log(
                `instance state ${inst?.State?.Name} for InstanceName: ${instanceNameTag?.Value} `
              );
              this.updateInstanceState({
                awsUrl: inst.PublicDnsName,
                id: inst.InstanceId,
                name: name,
                ip: inst.PublicIpAddress || null,
              });
              isRunning = true;
            }
          });
        })
        .catch((e) => {
          console.error(e);
          throw e;
        });
    } catch (error) {
      isRunning = false;
    }
    return isRunning;
  };

  async getInstanceInfo(queryInstance: { id?: string; name: string }) {
    const ids = queryInstance.id ? [queryInstance.id] : undefined;
    return await this.client
      .send(
        this.cmd.describeInstance({
          InstanceIds: ids,
          Filters: [
            {
              Name: "tag:Name",
              Values: [queryInstance.name],
            },
            {
              Name: "instance-state-name",
              Values: [InstanceStateName.running],
            },
          ],
        })
      )
      .then((res) => {
        return res.Reservations?.flatMap(
          (reservation) => reservation.Instances
        );
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }
}
