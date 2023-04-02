import {
  DescribeImagesCommand,
  EC2Client,
  InstanceStateName,
} from "@aws-sdk/client-ec2";
import { $, execa } from "execa";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { env } from "../utils/env";
import { InstanceCmdFactories } from "./instanceFactories";
import { polling, sleep } from "./utils";

type InstanceConfigType = {
  region?: string;
  sshPrivateKey?: string;
};

type LaunchInstanceConfig = {
  name: string;
  amiId?: string;
  sshPublicKey: string;
  instanceType?: string;
};

type InitializeInstance = {
  name: string | null;
  dns: string | null;
  id: string | null;
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

  private cmd: typeof InstanceCmdFactories;

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
    try {
      if (await this.isRunning(instanceConfig.name)) {
        //clean previous running docker images

        await this.getInstanceInfo({
          name: instanceConfig.name,
        })
          .then(async (res) => {
            //skip creating new instance
            await this.stopDockerContainer();
            const oldInstance = res.Reservations?.[0].Instances?.[0];
            this.initializeInstance({
              dns: oldInstance?.PublicDnsName || null,
              id: oldInstance?.InstanceId || null,
              name: instanceConfig.name || null,
            });
          })
          .catch((e) => console.error(e));
        // start the same instance
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
            ImageId: "ami-02f3f602d23f1659d",
            InstanceType: "t2.micro",
            SecurityGroupIds: ["sg-094c1c2ff2866aeb1"],
            SecurityGroups: ["new_SG_test"],
            KeyName: "test-instance",
            TagSpecifications: [
              {
                ResourceType: "instance",
                Tags: [
                  {
                    Key: "Name",
                    Value: instanceConfig.name,
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
          this.initializeInstance({
            dns: launchedInstance?.PublicDnsName || null,
            id: launchedInstance?.InstanceId || null,
            name: instanceConfig.name || null,
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
        cb: async () => await this.isRunning(instanceName),
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

  async setUpStartUpScript() {
    try {
      const currentDir = process.cwd();
      const startScript = join(
        currentDir,
        "../core/src/uploadScript/upload.sh"
      );
      await this.scp({ source: startScript, target: "/etc/prbranch" });
      //@TODO change the dockerimage tag based on the pullRequest and commit sha
      await this.ssh(`cd /etc/prbranch && sh upload.sh -a /app -g pullpreview`);
    } catch (error) {
      throw new Error("Failed to cpy startUp script to instance", {
        cause: error,
      });
    }
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
    const tempPrivateKey = join(process.cwd(), "../../tmp/private");
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

    const tempPrivateKey = join(process.cwd(), "../../tmp/private");

    if (!existsSync(tempPrivateKey)) {
      writeFileSync(tempPrivateKey, privateKey, { mode: "0600" });
      console.log(`Private key saved to ${tempPrivateKey}`);
    }
    const cmdToRun = `ssh ${
      debug ? "-v" : ""
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

  private initializeInstance(currentInstance: InitializeInstance) {
    this.instanceName = currentInstance.name;
    this.launchedInstanceId = currentInstance.id;
    this.publicDns = currentInstance.dns;
  }

  private isRunning = async (name: string) => {
    let isRunning = false;
    const instanceId = this.launchedInstanceId;

    console.log(`\nInstance with instanceId:${instanceId} running\n`);
    try {
      await this.getInstanceInfo({ id: instanceId || undefined, name })
        .then((res) => {
          console.log(`checking instance ${instanceId} state`);
          const instance = res.Reservations?.at(0);
          instance?.Instances?.forEach((inst) => {
            console.log(`instance state ${inst?.State?.Name}`);
            if (
              inst?.State?.Name &&
              this.liveInstanceState(inst?.State?.Name)
            ) {
              //dns gets assigned only when the instance is live

              if (inst.PublicDnsName && inst.InstanceId)
                this.initializeInstance({
                  dns: inst.PublicDnsName,
                  id: inst.InstanceId,
                  name: name,
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

  private liveInstanceState = (state: string | InstanceStateName) =>
    [InstanceStateName.running].includes(state as InstanceStateName);

  private async getInstanceInfo(queryInstance: { id?: string; name: string }) {
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
          ],
        })
      )
      .then((res) => {
        return res;
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }
}
