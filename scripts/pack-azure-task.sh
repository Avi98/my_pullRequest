#!/bin/bash

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <taskVersion>"
    exit 1
fi

base_repo_path=$PWD
upload_script_path="uploadScript"
azure_task_dir="$base_repo_path/apps/azure-task"


if [[ $PWD == "/Users/avinash/oss/mono-review/apps/azure-task" ]]; then
azure_task_dir="/Users/avinash/oss/mono-review/apps/azure-task"
upload_script_path="/Users/avinash/oss/mono-review/uploadScript"
fi

taskPath="$azure_task_dir/taskVersions/task.$1.json"
taskDirPath="$azure_task_dir/.dist/task"


echo "Copying task to $taskDirPath"
cp  "$azure_task_dir/package.json" "$azure_task_dir/.dist/package.json"
cp  "$azure_task_dir/vss-extension.json" "$azure_task_dir/.dist/vss-extension.json"


cp -r "$azure_task_dir/images/." "$azure_task_dir/.dist/images"
cp -r "$upload_script_path" "$taskDirPath"

echo "Creating task.json"
cp "$taskPath" "$taskDirPath/task.json"

echo "Installing dependencies"
(
    cd "$azure_task_dir/.dist" && npm install && cd -
)

chmod -R 777 "$azure_task_dir/.dist"

# tfx extension create --root . "$azure_task_dir/.dist" --manifest-globs "$azure_task_dir/.dist/vss-extension.json" --output-path "$azure_task_dir/.dist"

tfx extension isvalid --vsix "$azure_task_dir/.dist/avinash-live-pr.build-release-task-0.0.93.vsix" --token "tnlywzsj2r53dge4n3qhpzjes52rynblhxphi4i5hqppseqbmtua"

# tfx extension publish \
#  --publisher "avinash-live-pr" \
#  --vsix "$azure_task_dir/.dist/avinash-live-pr.build-release-task-0.0.91.vsix" \
#  --token "tnlywzsj2r53dge4n3qhpzjes52rynblhxphi4i5hqppseqbmtua" \
#  --output-path "$azure_task_dir/.dist"
