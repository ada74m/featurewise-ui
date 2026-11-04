#!/usr/bin/env bash
# Builds the shell's package for a version: its Terraform module and the built shell beside it, as
# <out-dir>/ui-<version>.zip, with the same contents unpacked in <out-dir>/ui. An environment uses it as
# source = "s3::https://.../ui/<version>.zip//Infrastructure".
set -euo pipefail
version=${1:?usage: package.sh <version> <out-dir>}
mkdir -p "${2:?usage: package.sh <version> <out-dir>}"
out=$(cd "$2" && pwd)
cd "$(dirname "$0")"

npm ci --silent
npm run --silent build

package="$out/ui"
rm -rf "$package" "$out/ui-$version.zip"
mkdir -p "$package/Infrastructure" "$package/dist"
rsync -a --include='*.tf' --exclude='*' Infrastructure/ "$package/Infrastructure/"
rsync -a --exclude='*.d.ts' dist/ "$package/dist/"

echo "$version" > "$package/VERSION"
(cd "$package" && zip -qrX "$out/ui-$version.zip" .)
echo "$out/ui-$version.zip"
