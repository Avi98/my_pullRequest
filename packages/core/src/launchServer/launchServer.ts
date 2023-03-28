import { execa } from "execa";
import { createReadStream, createWriteStream, existsSync } from "fs";

import { join } from "path";
import { createGzip } from "zlib";
import { Instance } from "../instance";
import { polling, sleep } from "../instance/utils";
import { env } from "../utils/env";

const config = {
  serverAppPath: "/etc/prbranch",
  localTempPath: join(process.cwd(), "../../tmp"),
  keyName: "my-proto-type-keyPair",
  tarballFile: "app.tar.gz",
};
export class LunchServer {
  instance: Instance;

  constructor(ec2: Instance) {
    this.instance = ec2;
  }

  async run(cloneLink: string) {
    try {
      const dockerfilePaths = cloneLink;
      const tmpAppPath = `${config.localTempPath}/${config.tarballFile}`;
      const git = this.getGitUrl(dockerfilePaths);
      await this.cloneRepo(git);
      await this.compressRepo(config.localTempPath);

      // launch instance
      await this.instance.launch({
        name: "tobechange",
        sshPublicKey: env.sshKeys.publicKey,
      });

      await sleep(10);

      try {
        await this.instance
          .waitUntilInstance()
          .then(async () => {
            //instance after starting tasks some time to start sshd
            await sleep(10);
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

        await sleep(10);
        await this.instance
          .createDockerImage(
            tmpAppPath,
            config.serverAppPath,
            config.tarballFile
          )
          // .then(async () => {
          //   await this.removeTempAppDir();
          // })
          .catch((e) => {
            throw e;
          });

        await Promise.all([
          // this.instance.moveStartScripts(tmpAppPath),
        ]);
      } catch (error) {
        // throw Error("Docker image creation failed aborting...", {
        //   cause: error,
        // });
        console.error(error);
      }
    } catch (error) {
      throw error;
    }
  }

  private async cloneRepo(git: { url: string; branch: string }) {
    await this.removeTempAppDir();
    try {
      console.log("cloning new dir");
      const repo = await execa(
        "git",
        [
          "clone",
          git.url,
          "--depth=1",
          `--branch=${git.branch}`,
          config.localTempPath,
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

    await execa("tar", [
      "cfz",
      `${repoPath}/${config.tarballFile}`,
      "--exclude",
      ".git",
      "-C",
      repoPath,
      ".",
    ])
      .then(() => console.log("compress and saved file"))
      .catch((e) => {
        throw new Error("File compress failed");
      });
  }
  private async removeTempAppDir() {
    if (existsSync(config.localTempPath)) {
      await execa("rm", ["-rf", config.localTempPath])
        .then(() => {
          console.log(`${config.localTempPath} removed`);
        })
        .catch(() => {
          throw new Error("Failed to remove dir");
        });
    } else {
      console.log("temp not found");
    }
  }

  extractRepo(path: string) {
    const opStream = createReadStream(path).pipe(createGzip());
    opStream.pipe(createWriteStream(config.localTempPath));
  }

  private getGitUrl(appPath: string) {
    const hasHttpRegEx = /^https?/;

    if (!hasHttpRegEx.test(appPath))
      throw new Error("APP_PATH should be git clone path");

    const [gitUrl, ref = "develop"] = appPath.split("#", 2);
    return { url: gitUrl, branch: ref };
  }
}
