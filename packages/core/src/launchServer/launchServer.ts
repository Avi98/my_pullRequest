import { execa } from "execa";
import { createReadStream, createWriteStream, existsSync } from "fs";

import { join } from "path";
import { createGzip } from "zlib";
import { Instance } from "../instance";

const config = {
  //   localTempPath: "/tmp/app",
  localTempPath: join(process.cwd(), "../../tmp"),
  keyName: "my-proto-type-keyPair",
};
export class LunchServer {
  instance: Instance;

  constructor(ec2: Instance) {
    this.instance = ec2;
  }

  async run(appPaths: string[] | string) {
    try {
      const dockerfilePaths =
        typeof appPaths === "string" ? [appPaths] : appPaths;
      const git = this.getGitUrl(dockerfilePaths[0]);
      await this.cloneRepo(git);
      await this.compressRepo(config.localTempPath);

      //launch instance
      this.instance.launch({
        appPath: "etc/pr",
        name: "tobechange",
        sshPublicKey:
          "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDT4ACnHtnXKv2ICo6SihQtgHQWcoh5djznb1QWCULzrJ0qzEXcBE+LEqeJUs1upuAh9NAO1mbfhmzp7VneXyWUcepd3YAgCAEIsvsyjjsVRVXR1UO8lR4g2r2ZCpYIKxorq3mLj2IDZq7NdnO/fO7vffKRWwm/lz1N73YcQDhlOBw94LbJWLjo7gL7txVU/Um90JVT/syPKkVzam4QIIzSdx9hePXxjZLrGkevMryH5JWWwhnZ7ny/Qg/nQHmdWtsczj1IHErkNUHYn1arQ8JRUilV/9/ki+6qhBH5xXMTDpp5EqS+PWFHFHh8VATfx0MVj+SpWzVDnczNxMRGxmAMhj3R61veefnwhmxdtl0euXYPSbwCqeCduztkOmnQp6cPMZ8Dqxvw2esWhpIeW86cu0Yze9u1UZfjIxCG4YgW476ivTDrWKxbrLpG291e01xvut6nZ8dQMr9fRE2uWMamMqJ0tg4EI66leFDakbXwr2joiB/dRWGd73yWdrRxJ20= avinash@Avinashs-MacBook-Pro.local",
      });
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
    ]).on("exit", (code) => {
      if (code !== 0) {
        throw new Error("Failed to compress repo");
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
