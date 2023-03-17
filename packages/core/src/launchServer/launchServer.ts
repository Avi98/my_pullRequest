import { execa, $ } from "execa";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  ReadStream,
  WriteStream,
} from "fs";

import { join } from "path";
import { createGzip, gunzip } from "zlib";
import { pipeline } from "stream/promises";

const config = {
  //   localTempPath: "/tmp/app",
  localTempPath: join(process.cwd(), "../../tmp"),
};
export class LunchServer {
  async run(appPaths: string[] | string) {
    try {
      const dockerfilePaths =
        typeof appPaths === "string" ? [appPaths] : appPaths;
      const git = this.getGitUrl(dockerfilePaths[0]);
      // this.extractRepo(`${config.localTempPath}/repo.gz`);
      await this.cloneRepo(git);
      await this.compressRepo(config.localTempPath);
    } catch (error) {
      console.error(error);
    }
  }

  private async cloneRepo(git: { url: string; branch: string }) {
    await this.removeTempAppDir();
    try {
      const repo = await execa("git", [
        "clone",
        git.url,
        "--depth=1",
        `--branch=${git.branch}`,
        config.localTempPath,
      ]);
      return repo;
    } catch (error) {
      throw new Error("Can not clone error", { cause: error });
    }
  }

  private async compressRepo(repoPath: string) {
    await execa("tar", [
      "cfz",
      `${repoPath}/app.tar.gz`,
      "--exclude",
      ".git",
      "-C",
      repoPath,
      ".",
    ])
      .on("error", (r) => {
        console.error(r);
      })
      .on("exit", (code) => {
        if (code !== 0) {
          throw new Error("Failed to compress repo.");
        }
      });
  }
  private async removeTempAppDir() {
    if (existsSync(config.localTempPath)) {
      await execa("rm", ["-rf", config.localTempPath]);
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

    const [gitUrl, ref = "main"] = appPath.split("#", 2);
    return { url: gitUrl, branch: ref };
  }
}
