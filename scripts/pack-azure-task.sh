#!/bin/bash

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <taskVersion>"
    exit 1
fi

base_repo_path=$(pwd)
upload_script_path="uploadScript"


azure_task_dir="$base_repo_path/apps/azure-task"
echo "before--> $azure_task_dir"

# if azure-task/apps is twice then remove one
if [ "$(echo "$azure_task_dir" | grep -o "apps/azure-task" | wc -l)" -gt 1 ] ; then
azure_task_dir=$(echo "$azure_task_dir" | sed 's/apps\/azure-task//' )
fi

echo "after--> $azure_task_dir"


taskPath="$azure_task_dir/taskVersions/task.$1.json"
taskDirPath="$azure_task_dir/.dist/task"


echo "Copying task to $taskDirPath"
cp  "$azure_task_dir/package.json" "$azure_task_dir/.dist/task/package.json"
cp  "$azure_task_dir/vss-extension.json" "$azure_task_dir/.dist/vss-extension.json"


cp -r "$azure_task_dir/images/." "$azure_task_dir/.dist/images"



(
cd ../../;
cp -r "$upload_script_path" "$taskDirPath"
)

echo "Creating task.json"
touch $taskDirPath/task.json && cat $taskPath > $taskDirPath/task.json 

chmod -R 777 "$azure_task_dir/.dist"

tfx extension create --root . "$azure_task_dir/.dist" --manifest-globs "$azure_task_dir/.dist/vss-extension.json" --output-path "$azure_task_dir/.dist"

