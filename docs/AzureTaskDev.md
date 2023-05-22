## Setting up azure task locally

### Develop

make sure `tfx-cli` is installed globally

to build task
`pnpm run build`

> **_Note_**: if updating make sure that `task.v1.json (or task.v2.json)` and `vss-extension.json` version is updated.

to pack V1 of task and create task extension
`pnpm run pack v1`

to pack V2 of task and create task extension
`pnpm run pack v2`

upload the new task file to Azure marketplace

### Development setup

To develop and test features locally

1. from root of the project run

`pnpm install`

2. to start project

`pnpm run dev`

This will start the packages/core that uses `REMOTE_REPO` env from the .env file. This env will be used as the

### Environnement variables

In order to setup and run task locally you need to have these envs.

| ENV           | Default value                      | Required | Description                                                               |
| ------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------- |
| REMOTE_REPO   | NULL                               | TRUE     | The Repository url that will be cloned                                    |
| REPO_ID       | NULL                               | TRUE     | Repository ID                                                             |
| PR_ID         | NULL                               | TRUE     | Pull request that needs to be used for creating live PR_ID                |
| PAT           | NULL                               | TRUE     | Personal access token form the server that is needed for making api calls |
| ORG_URL       | NULL                               | TRUE     | Azure organization url in which the project is                            |
| PROJECT_NAME  | NULL                               | TRUE     | Azure repo project name                                                   |
| BUILD_REASON  | PullRequest                        | FALSE    | Basically trigger for build pipeline                                      |
| TARGET_BRANCH | develop                            | FALSE    | git targetBranch                                                          |
| SOURCE_BRANCH | develop                            | FALSE    | git source branch for live                                                |
| CLONE_PATH    | join(process.cwd(), "../temp_app") | FALSE    | temp clone path.                                                          |

#### AWS EC2 Environnement variables

---

Other than git variables you will also be needing AWS EC2 variables

| ENV             | Default value         | Required | Description                                                                                                                                                                                                                        |
| --------------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NODE_ENV        | develop               | FALSE    | NODE_ENV is develop by default.                                                                                                                                                                                                    |
| SSH_PRIVATE_KEY | NULL                  | TRUE     | ssh key used for                                                                                                                                                                                                                   |
| IMAGE_ID        | ami-02f3f602d23f1659d | FALSE    | The default AWS AMI used. Learn more about it from [here.](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html)                                                                                                          |
| IMAGE_TYPE      | t2.micro              | FALSE    | t2.micro is smallest and cheapest instance type provided by AWS. Can learn more about it [here](https://aws.amazon.com/ec2/instance-types/t2/)                                                                                     |
| SG_ID           | NULL                  | TRUE     | Stands for AWS security group. This variable holds the id of the security group that you create. It AWS EC2's virtual firewall. More about it [here](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html) |
| SG              | NULL                  | TRUE     | Name of the AWS Security group that holds rules about ports access for inbound and outbound rules                                                                                                                                  |
