import { env } from '@pr/common';

console.log({ envProt: parseInt(env.port_BE) });
export default () => ({
  port: parseInt(env.port_BE, 10) || 3030,
});
