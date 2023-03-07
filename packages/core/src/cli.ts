import { execa } from "execa";
import { rmdir, rmdirSync } from "fs";
import { join } from "path";
import tar from "tar";

//@TODO remove this after the POC
const defaultConfig = {
  repo_url: "https://github.com/selfup/nextjs-docker.git",
  repoDir: "repo_dir",
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

export const main = () => {
  //get currentDir path check for repo_dir
  // if repo_dir is there then leave else crete one dir

  //get github repo
  const cwd = process.cwd();
  const repo_dir = join(cwd, defaultConfig.repoDir);
  execa("git", ["clone", defaultConfig.repo_url, repo_dir]).then((res) => {
    //tarball the repo

    tar.c({ gzip: true, file: `${repo_dir}.tgz` }, [repo_dir]).then((re) => {
      console.log({ re: "saved tar" });
      //clean up the tar.bar
      // rmdir(repo_dir, { recursive: true }, (err) => {
      //   console.log(err);
      // });
    });
  });
};
