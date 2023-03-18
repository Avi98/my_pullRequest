import {
  DescribeImagesCommand,
  EC2Client,
  InstanceStateName,
} from "@aws-sdk/client-ec2";
import { InstanceCmdFactories } from "./instanceFactories";

/**
 * Creates EC2 instance/
 * 1. launch instance
 * 2. open_ports
 * 3. wait until ssh is ready
 * 4. scp files from git repo to instance
 * 5. destroy instance
 */

type InstanceConfigType = {
  region?: string;
};

type LaunchInstanceConfig = {
  name: string;
  amiId?: string;
  appPath: string;
  sshPublicKey: string;
  instanceType?: string;
};
interface IInstance {
  launch: (config: LaunchInstanceConfig) => void;
}
export class Instance implements IInstance {
  private client: EC2Client;
  private cmd: typeof InstanceCmdFactories;

  constructor({ region = "us-east-1" }: InstanceConfigType) {
    this.cmd = InstanceCmdFactories;
    this.client = InstanceCmdFactories.createInstance({ region });
  }

  /**
   * checks if the instance already exsits.
   * if not exits create new instance should be created
   *
   * @TODO ami_id gets changed frequently need to find dynamic ami-id.
   * @param instanceConfig
   */
  async launch(instanceConfig: LaunchInstanceConfig) {
    try {
      if (await this.isRunning(instanceConfig.name)) {
        console.log({ instance: "instance already running" });
        // start the same instance
        return;
      }

      const userData = [
        `echo '${instanceConfig.sshPublicKey}\n' > /home/ec2-user/.ssh/authorized_keys`,
        `echo 'cd ${instanceConfig.appPath}' > /etc/profile.d/pullpreview.sh`,
        //swapfile
        "fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile",
        "echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab",
        "sysctl vm.swappiness=10 && sysctl vm.vfs_cache_pressure=50",
        "echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf",
        "echo 'vm.vfs_cache_pressure=50' | tee -a /etc/sysctl.conf",
        //install docker
        "yum install -y docker",
        "sudo systemctl start docker",
        //clean up stale images
        "echo 'docker image prune -a --filter=\"until=96h\" --force' > /etc/cron.daily/docker-prune && chmod a+x /etc/cron.daily/docker-prune",
        //set is ready state
        "mkdir -p /etc/prbranch && touch /etc/prbranch/ready && chown -R ec2-user:ec2-user /etc/prbranch",
      ].join(" && ");

      //create same instance
      await this.client.send(
        this.cmd.runInstance({
          MaxCount: 1,
          MinCount: 1,
          //todo
          UserData: btoa(userData),
          ImageId: "ami-02f3f602d23f1659d",
          InstanceType: "t2.micro",
          TagSpecifications: [
            {
              ResourceType: "instance",
              Tags: [
                {
                  Key: "Name",
                  Value: instanceConfig.name,
                },
              ],
            },
          ],
        })
      );
    } catch (error) {
      throw new Error(`${instanceConfig.name} lunch error`, { cause: error });
    }
  }

  private async isRunning(name: string) {
    let isRunning = false;
    try {
      await this.getInstanceInfo(name)
        .then((res) => {
          res.Reservations?.map((reserve) => {
            reserve.Instances?.filter((ins) => {
              if (ins.State?.Name && this.liveInstanceState(ins.State?.Name)) {
                console.log({ ins, instatantState: ins.State });
                isRunning = true;
                return;
              }
            });
          });
        })
        .catch((e) => {
          console.error(e);
          throw e;
        });
    } catch (error) {
      isRunning = false;
    }
    return isRunning;
  }

  private liveInstanceState = (state: string | InstanceStateName) =>
    [
      InstanceStateName.pending,
      InstanceStateName.running,
      InstanceStateName.stopping,
    ].includes(state as InstanceStateName);

  private async getInstanceInfo(name: string) {
    return await this.client
      .send(
        this.cmd.describeInstance({
          Filters: [
            {
              Name: "tag:Name",
              Values: [name],
            },
          ],
        })
      )
      .then((res) => res)
      .catch((e) => {
        throw e;
      });
  }
}
