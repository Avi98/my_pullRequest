#!/bin/bash

if [$# -ne 1];then	
	echo "Ussage: $0 <taskVersion>"
	exit 1
fi

taskPath=./taskVersions/task.$1.json
distPath=.dist/task

echo "copying task to $distPath"

cp -r node_modules  $distPath
cp -r package.json  $distPath

# cpy bash script for starting docker in instance
cp -r ../../uploadScript .dist/task/core
cp -r images .dist

cp vss-extension.json .dist

touch $distPath/task.json && cat $taskPath > $distPath/task.json 

cd $distPath && npm i && cd - 

NODE_ENV="prod"
# change dir to .dist and then only run tfx pack cmd
cd .dist && tfx extension create --manifest-globs && cd -