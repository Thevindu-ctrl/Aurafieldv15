#!/usr/bin/env bash
set -e

echo "========================================"
echo " Running Local Automation Diagnostics..."
echo "========================================"

npm install
if npm run build; then
    echo "========================================"
    echo " Build Integrity Verified Successfully!"
    echo "========================================"
else
    echo " Compilation failed. Check errors above."
    exit 1
fi