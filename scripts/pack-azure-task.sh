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
distPath="$azure_task_dir/.dist/task"

echo "Copying task to $distPath"
cp -r "$azure_task_dir/vss-extension.json" "$azure_task_dir/.dist"
cp -r node_modules package.json $upload_script_path "$azure_task_dir/images" "$distPath"

chmod -R +x $PWD


echo "Creating task.json"
cp "$taskPath" "$distPath/task.json"

echo "Installing dependencies"
(
    cd "$distPath" && pnpm i && cd -
)

echo "Building extension"
(
    cd "$azure_task_dir/.dist" && npx tfx-cli extension create --manifest-globs
)
