import { $ } from "execa";
import { chmod, chmodSync, existsSync, writeFileSync } from "fs";
import { async } from "q";

type PollingType = {
  maxRetries?: number;
  interval?: number;
  cb?: () => Promise<boolean>;
};
export const polling = async ({
  maxRetries = 30,
  interval = 5,
  cb,
}: PollingType) => {
  let result = true;
  let retires = 0;

  const callAgain = () =>
    maxRetries === retires
      ? cb?.()
          .then((res) => {
            console.log("polling successfully ✅ ");
            return res;
          })
          .catch((e) => {
            throw e;
          })
      : cb?.().catch((e) => {
          console.error(JSON.stringify(e));
        });
  while (!(await callAgain())) {
    retires++;
    if (retires >= maxRetries) {
      result = false;
      break;
    }
    await new Promise((res) => setTimeout(res, interval * 1000));
  }
  return result;
};

export const sleep = (timeout = 2) => {
  console.log(`sleep for ${timeout}s`);
  return new Promise((res) =>
    setTimeout(() => {
      res("");
    }, 1000 * timeout)
  );
};

export const createPrivateIdentity = async (
  tempPrivateKeyPath: string,
  privateKey: string
) => {
  console.log("🔑 Not found file privateKey ❌");
  writeFileSync(tempPrivateKeyPath, "");
  await $({
    verbose: true,
    shell: true,
  })`echo ${privateKey} | tr -d '\r' > ${tempPrivateKeyPath}`
    .then(async (temp) => {
      await $`chmod 600 ${tempPrivateKeyPath}`;
      console.log(temp);
      console.log("private key saved");
    })
    .catch((e) => {
      console.log("private key failed to save");
      console.error(e);
      console.log("--------");
    });
};
