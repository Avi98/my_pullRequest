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

  while (!(await cb?.())) {
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
  return new Promise((res) =>
    setTimeout(() => {
      res(console.log(`sleep for ${timeout}s`));
    }, 1000 * timeout)
  );
};
