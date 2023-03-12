import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";
import { pipeline } from "stream";

const config = {
  //   localTempPath: "/tmp/app",
  localTempPath: join(process.cwd(), "tmp"),
};
export class LunchServer {
  /**
   * 1. get git path
   * 2. checkout and clone repo
   * 3. zip file
   * 4. initiate ec2 instance
   */
  async run(appPaths: string[] | string) {
    try {
      const dockerfilePaths =
        typeof appPaths === "string" ? [appPaths] : appPaths;

      const git = this.getGitUrl(appPaths[0]);
      await this.tarRepo(git);
    } catch (error) {
      console.error(error);
    }
  }

  async tarRepo(git: { url: string; branch: string }) {
    try {
      const readRepoStream = await this.cloneRepo(git);
      const compressRepoStream = await this.tarballChunks();

      if (readRepoStream && compressRepoStream) {
        readRepoStream.pipe(compressRepoStream);
      }
    } catch (error) {
      throw new Error(
        "RepoDownloadCompressFailed: Failed to download repo and compress",
        { cause: error }
      );
    }
  }

  async cloneRepo({ url, branch }: { url: string; branch: string }) {
    // remove tmp/app
    await this.removeTempAppDir();

    return execa("git clone", [
      url,
      "branch",
      "--depth=1",
      `--branch=${branch}`,
      config.localTempPath,
    ]).all;
  }

  async tarballChunks() {
    return execa("tar", ["czf", "/tmp/app.tar.gz", "--exclude"]).stdin;
  }

  async removeTempAppDir() {
    if (existsSync(config.localTempPath)) {
      await execa("rm", ["-rf", config.localTempPath]);
    }
  }

  getGitUrl(appPath: string) {
    const hasHttpRegEx = /^https?/;

    if (!hasHttpRegEx.test(appPath))
      throw new Error("APP_PATH should be git clone path");

    const [gitUrl, ref = "master"] = appPath.split("#", 2);
    return { url: gitUrl, branch: ref };
  }
}
