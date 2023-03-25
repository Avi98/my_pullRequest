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
