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
