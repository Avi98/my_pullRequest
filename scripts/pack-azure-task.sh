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
cp  "$azure_task_dir/package.json" "$azure_task_dir/.dist"
cp  "$azure_task_dir/vss-extension.json" "$azure_task_dir/.dist"


cp -r "$azure_task_dir/images/." "$azure_task_dir/.dist/images"
cp -r "$upload_script_path" "$distPath"

echo "Creating task.json"
cp "$taskPath" "$distPath/task.json"

echo "Installing dependencies"
(
    cd "$distPath" && pnpm i && cd -
)

chmod -R 777 "$azure_task_dir/.dist"

echo "azure_task_dir: $azure_task_dir"
ls -la "$azure_task_dir/.dist"
ls -la "$azure_task_dir/.dist/vss-extension.json"

# cp -R --copy-contents "$azure_task_dir/.dist/node_modules" "$azure_task_dir/.dist/node_modules_cp" && rm -r "$azure_task_dir/.dist/node_modules" && mv "$azure_task_dir/.dist/node_modules_cp" "$azure_task_dir/.dist/node_modules"

tfx extension create --root . "$azure_task_dir/.dist" --manifest-globs "$azure_task_dir/.dist/vss-extension.json" --output-path "$azure_task_dir/.dist"
