#!/bin/bash

# Remove node_modules and .dist directories in the root directory
rm -rf node_modules
rm -rf .dist
rm -rf .turbo
rm -rf pnpm-lock.yaml

# Recursively search for child directories that contain node_modules, turbo and .dist directories
for dir in $(find . -name "node_modules" -type d -prune) ; do
  echo "Removing $dir"
  rm -rf $dir
done

for dir in $(find . -name ".turbo" -type d -prune) ; do
  echo "Removing $dir"
  rm -rf $dir
done

for dir in $(find . -name ".dist" -type d -prune) ; do
  echo "Removing $dir"
  rm -rf $dir
done