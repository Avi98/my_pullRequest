import { execa } from "execa";

//@TODO remove this after the POC
const defaultConfig = {
  repo_url: "https://github.com/selfup/nextjs-docker.git",
};

/**
 * fetch all github repo
 *
 */

export const main = async () => {
  //get github repo
  const stdout = await execa("git", ["clone", defaultConfig.repo_url])
    .then((ress) => {
      console.log({ ress });
    })
    .catch((e) => {
      console.log({ error: JSON.stringify(e) });
    });
};
