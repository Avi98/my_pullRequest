#!/bin/bash

# This script removes all node_modules directories in the current directory and its subdirectories

echo "Cleaning node_modules..."

# Find all directories named node_modules in the current directory and its subdirectories, then remove them
find . -name "node_modules" -type d -exec rm -rf {} +

echo "Done!"