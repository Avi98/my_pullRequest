#!/bin/bash

taskPath=./taskVersions/task.$1.json
distPath=.dist/task

echo "copying task to $distPath"

cp -r node_modules  $distPath
cp package.json  $distPath

# cpy bash script for starting docker in instance
cp -r ../../uploadScript .dist/task/core


cd $distPath && npm i && cd - 

NODE_ENV="dev"
# change dir to .dist and then only run tfx pack cmd
