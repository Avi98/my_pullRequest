import {
  DescribeRegionsCommandInput,
  RunInstancesCommand,
  DescribeInstancesCommand,
  RunInstancesCommandInput,
  DescribeInstancesCommandInput,
  DescribeRegionsCommand,
  DescribeImagesCommandInput,
  DescribeImagesCommand,
} from "@aws-sdk/client-ec2";

export class InstanceCmdFactories {
  static getRunInstanceCmd(input: RunInstancesCommandInput) {
    return new RunInstancesCommand(input);
  }

  static getInstance(input: DescribeInstancesCommandInput) {
    return new DescribeInstancesCommand(input);
  }

  static getRegions(input: DescribeRegionsCommandInput) {
    return new DescribeRegionsCommand(input);
  }

  static getImages(input: DescribeImagesCommandInput) {
    return new DescribeImagesCommand(input);
  }
}
