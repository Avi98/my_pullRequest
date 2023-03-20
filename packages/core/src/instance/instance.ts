import {
  DescribeImagesCommand,
  EC2Client,
  InstanceStateName,
} from "@aws-sdk/client-ec2";
import { $, execa } from "execa";
import { existsSync, writeFileSync, writeSync } from "fs";
import { join } from "path";
import { env } from "../utils/env";
import { InstanceCmdFactories } from "./instanceFactories";
import { polling } from "./utils";

type InstanceConfigType = {
  region?: string;
  sshPrivateKey?: string;
};

type LaunchInstanceConfig = {
  name: string;
  amiId?: string;
  appPath: string;
  sshPublicKey: string;
  instanceType?: string;
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

    console.log({ env: env.sshKeys });
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
      this.instanceName = instanceConfig.name;

      // if (await this.isRunning(instanceConfig.name)) {
      //   console.log({ instance: "instance already running" });
      //   // start the same instance
      //   return;
      // }

      const userData = [
        `#!/bin/bash
        yum install -y docker`,
        "usermod -aG docker ec2-user",
        "service docker start",
        "echo 'docker image prune -a --filter=\"until=96h\" --force' > /etc/cron.daily/docker-prune && chmod a+x /etc/cron.daily/docker-prune",
        "mkdir -p /etc/prbranch && touch /etc/prbranch/ready && chown -R ec2-user:ec2-user /etc/prbranch",
      ].join(" && ");

      const bufferString = Buffer.from(userData).toString("base64");

      await this.client
        .send(
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
          this.launchedInstanceId =
            instance.Instances?.at(0)?.InstanceId || null;

          return instance.Instances?.at(0)?.InstanceId;
        })
        .catch((e) => {
          throw e;
        });
    } catch (error) {
      throw new Error(`${instanceConfig.name} lunch error`, { cause: error });
    }
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

  async verifySshConnection() {
    await this.ssh(`test -f ${this.semaphore}`);
  }

  private async scp(cmd: string) {}

  private async ssh(cmd: string) {
    const publicDns = this.publicDns;
    const privateKey = this.privateKey;
    // const sshAddress = `${this.instanceName}@${this.publicDns}`;
    const sshAddress = `ec2-user@${this.publicDns}`;

    // console.log({ privateKey });
    // //@todo create common file
    const tempPrivateKey = join(process.cwd(), "../../tmp/private");

    if (!existsSync(tempPrivateKey)) {
      writeFileSync(tempPrivateKey, privateKey, { mode: 0o600 });
      console.log(`Private key saved to ${tempPrivateKey}`);
    }

    if (publicDns)
      await $`ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 -i ${tempPrivateKey} ${sshAddress} ${cmd}`
        .then((_) => {
          console.log(
            `successfully ran this cmd $ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 -i ${tempPrivateKey} ${sshAddress} ${cmd}`
          );
        })
        .catch((e) => {
          throw new Error("Error while logging the cmd", { cause: e });
        });
  }

  private async isRunning(name: string) {
    let isRunning = false;
    const instanceId = this.launchedInstanceId;
    try {
      if (!instanceId)
        throw new Error("Can not check running status without instanceId");
      await this.getInstanceInfoById(instanceId, name)
        .then((res) => {
          console.log(`checking is running ${res.$metadata.attempts}`);
          const instance = res.Reservations?.at(0);
          instance?.Instances?.forEach((inst) => {
            console.log(`instance name ${inst.Tags?.at(0)?.Value}`);
            console.log(`instance state ${inst?.State?.Name}`);
            if (
              inst?.State?.Name &&
              this.liveInstanceState(inst?.State?.Name)
            ) {
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
  }

  private liveInstanceState = (state: string | InstanceStateName) =>
    [InstanceStateName.running].includes(state as InstanceStateName);

  private async getInstanceInfoById(id: string, name: string) {
    return await this.client
      .send(
        this.cmd.describeInstance({
          InstanceIds: [id],
          Filters: [
            {
              Name: "tag:Name",
              Values: [name],
            },
          ],
        })
      )
      .then((res) => res)
      .catch((e) => {
        throw e;
      });
  }
}
