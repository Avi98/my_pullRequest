import {
  CreateImageCommand,
  DescribeImagesCommand,
  DescribeRegionsCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import { InstanceCmdFactories } from "./instanceFactories";

/**
 * Creates EC2 instance/
 * 1. launch instance
 * 2. open_ports
 * 3. wait until ssh is ready
 * 4. scp files from git repo to instance
 * 5. destroy instance
 */

type InstanceConfigType = {
  dns: string;
  defaultPort: string;
  instanceType: string;
};

export class Instance {
  private dns: string;
  private client: EC2Client;
  private defaultPort: string;
  private instanceType: string;

  constructor(
    ec2: EC2Client,
    { defaultPort, instanceType, dns }: InstanceConfigType
  ) {
    this.dns = dns;
    this.client = ec2;
    this.instanceType = instanceType;
    this.dns = this.defaultPort = defaultPort;
  }

  async launch() {
    await this.client.send();
  }

  async isRegion({
    regionsInstance,
    instanceId,
    regionCode,
  }: {
    regionsInstance: () => typeof DescribeImagesCommand;
    instanceId: string;
    regionCode: string;
  }) {
    try {
      const regionCmd = InstanceCmdFactories.getRegions({});
      const hasRegion = await this.client.send(regionsInstance);
      hasRegion.Regions?.includes(regionCode);
    } catch (error) {}
  }
}
