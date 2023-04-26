## Azure task for preview PR

### Develop

make sure `tfx-cli` is installed globally

to build task
`pnpm run build`

**_Note_**: if updating make sure that `task.v1.json (or task.v2.json)` and `vss-extension.json` version is updated.

to pack V1 of task and create task extension
`pnpm run pack v1`

to pack V2 of task and create task extension
`pnpm run pack v2`

upload the new task file to Azure marketplace

### TODO

check for the "PR-link" task

- run instance
- create a comment on the PR with a link
