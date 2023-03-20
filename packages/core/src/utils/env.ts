const castEnv = <T = string>({
  env,
  name,
}: {
  env: T | undefined;
  name: string;
}): T => {
  if (!env) throw new Error(`\n ENV for ${name} not provided`);
  return env;
};

export const env = {
  sshKeys: {
    publicKey: castEnv({
      env: process.env.SSH_PUBLIC_KEY,
      name: "SSH_PUBLIC_KEY",
    }),
    privateKey: castEnv({
      env: process.env.SSH_PRIVATE_KEY,
      name: "SSH_PRIVATE_KEY",
    }),
  },
};
