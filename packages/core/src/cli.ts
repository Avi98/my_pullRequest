import tar from "tar";
import * as dotenv from "dotenv";
import { execa } from "execa";
import { existsSync, rm, rmdir, rmSync } from "fs";
import { join } from "path";
import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeImagesCommand,
} from "@aws-sdk/client-ec2";

dotenv.config();

//@TODO remove this after the POC
const defaultConfig = {
  repo_url: "https://github.com/selfup/nextjs-docker.git",
  repoDir: "repo_dir",
  region: "us-east-1",
  imageId: "ami-09a0dac4253cfa03f",
  instanceType: "t3.nano",
  keyName: "my-proto-type-keyPair",
};

/**
 * fetch all github repo,
 * create new dir
 * zip the repo
 * ssh to aws
 * aws unzipe
 * aws create docker build
 *
 */

const cwd = process.cwd();
const repo_dir = join(cwd, defaultConfig.repoDir);

export const main = () => {
  cleanupRepo();

  execa("git", ["clone", defaultConfig.repo_url, repo_dir]).then((res) => {
    tar.c({ gzip: true, file: `${repo_dir}.tgz` }, [repo_dir]).then((re) => {
      console.log({ re: "saved tar" });
      cleanupRepo();

      /**
       * find all the instance
       * keypari auth
       * ssh file transfer
       * create docker build on ssh
       */
      connectInstance();
    });
  });
};

const connectInstance = async () => {
  const client = new EC2Client({
    region: defaultConfig.region,
  });

  const launchInstance = new RunInstancesCommand({
    MaxCount: 1,
    MinCount: 1,
    ImageId: defaultConfig.imageId,
    KeyName: defaultConfig.keyName,
    InstanceType: defaultConfig.instanceType,
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          {
            Key: "Name",
            Value: "my-proto-type-instance",
          },
        ],
      },
    ],
  });

  const availableRegions = new DescribeRegionsCommand({
    RegionNames: [defaultConfig.region],
  });
  const availableImages = new DescribeImagesCommand({
    ImageIds: [defaultConfig.imageId],
  });

  client.send(availableRegions).then((regions) => {
    console.log({ regions: JSON.stringify(regions) });
  });

  client.send(availableImages).then((images) => {
    console.log({ images: JSON.stringify(images) });
  });
  client.send(launchInstance).then((images) => {
    const instanceId = images.Instances?.filter;
    console.log({ launchInstance: JSON.stringify(images) });
  });

  const getInstance = new DescribeInstancesCommand({});
  client.send(getInstance).then((instance) => {
    console.log({ instanceInfo: instance });
  });
};

const cleanupRepo = () => {
  if (existsSync(repo_dir)) {
    rmSync(repo_dir, { recursive: true });
  }
};
