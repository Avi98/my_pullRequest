import { $, execa } from "execa";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { Instance } from "../instance/index.js";
import { polling, sleep } from "../instance/utils.js";
import { env } from "../utils/env.js";
import { buildContext } from "../../buildContext.js";

const config = {
  serverAppPath: "/etc/prbranch/app/app.tar.gz",
  workingDir: buildContext.clonePath,
  clonePath: `${buildContext.clonePath}/app`,
  keyName: "my-proto-type-keyPair",
  tarballFile: `${buildContext.clonePath}/app.tar.gz`,
  sourceBranch: buildContext.sourceBranch,
};
export class LunchServer {
  instance: Instance;

  constructor(ec2: Instance) {
    this.instance = ec2;
  }

  async run(cloneLink: string) {
    try {
      const dockerfilePaths = cloneLink;
      const git = this.getGitUrl(dockerfilePaths, config.sourceBranch);
      if (!config.clonePath) throw new Error("Clone Path not found");

      console.log({ clone: config.clonePath });
      await this.cloneRepo({ ...git, clonePath: config.clonePath });
      await this.compressRepo(config.clonePath);

      if (!env.securityGroup || !env.securityId || !env.keyName)
        throw new Error(
          "Can not launch instance without security group, and keyName"
        );

      // launch instance
      await this.instance.launch({
        name: git.branch,
        sshPublicKey: env.sshKeys.publicKey,
        keyName: env.keyName,
        securityGroupId: env.securityId,
        securityGroupName: env.securityGroup,
        imageId: env.imageId,
        imageType: env.imageType,
        instanceType: env.imageType,
      });

      await sleep(5);

      try {
        await this.instance
          .waitUntilInstance()
          .then(async () => {
            //instance after starting tasks some time to start sshd
            await sleep(5);
            try {
              await polling({
                maxRetries: 3,
                cb: () => this.instance.verifySshConnection(),
              });
              console.log("\n SSH connection established 🎉 \n");
            } catch (error) {
              throw error;
            }
          })
          .catch((e) => {
            throw new Error("SSH connection failed aborting... ");
          });

        // already running instance should, start from snap shot instance
        // await this.instance.cleanDockerImgs();

        await sleep(5);
        await this.instance.cpyTarOnInstance(
          `${config.tarballFile}`,
          config.serverAppPath
        );

        await this.instance.mvStartScriptToServer();
      } catch (error) {
        console.error(error);
        throw Error("Docker image creation failed aborting...", {
          cause: error,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  private async cloneRepo(git: {
    url: string;
    branch: string;
    clonePath: string;
  }) {
    // await this.removeTempAppDir();
    try {
      console.log("cloning new dir");
      const repo = await execa(
        "git",
        [
          "clone",
          git.url,
          "--depth=1",
          `--branch=${git.branch}`,
          git.clonePath,
        ],
        { verbose: true }
      );
      return repo;
    } catch (error) {
      throw new Error("Can not clone error", { cause: error });
    }
  }

  private async compressRepo(repoPath: string) {
    console.log("Compressing new dir");
    const whoami = await $`whoami`;
    console.log({ whoami: whoami.stdout });
    const isDir = await $`ls ${repoPath}`;
    console.log({ isDir });
    const files = await $`ls -ld ${repoPath}`;
    console.log({ files });

    console.log("cmd running");
    console.log(
      `tar ${[
        "cfz",
        `${config.tarballFile}`,
        "--exclude",
        ".git",
        "-C",
        repoPath,
        ".",
      ].join(" ")} `
    );

    await execa("tar", [
      "cfz",
      `${config.tarballFile}`,
      "--exclude",
      ".git",
      "-C",
      repoPath,
      ".",
    ])
      .then(() => console.log("compress and saved file"))
      .catch((e) => {
        throw new Error("File compress failed", { cause: e });
      });
  }
  private async removeTempAppDir(tempDir: string) {
    if (existsSync(tempDir)) {
      await execa("rm", ["-rf", tempDir])
        .then(() => {
          console.log(`${tempDir} removed`);
        })
        .catch(() => {
          throw new Error("Failed to remove dir");
        });
    } else {
      console.log("temp not found");
    }
  }

  // extractRepo(path: string) {
  //   const opStream = createReadStream(path).pipe(createGzip());
  //   opStream.pipe(createWriteStream(config.clonePath));
  // }

  private getGitUrl(appPath: string, sourceBranch = "develop") {
    const hasHttpRegEx = /^https?/;

    if (!hasHttpRegEx.test(appPath))
      throw new Error("APP_PATH should be git clone path");

    const [gitUrl] = appPath.split("#", 2);

    return { url: gitUrl, branch: sourceBranch?.replace?.("refs/heads/", "") };
  }
}
