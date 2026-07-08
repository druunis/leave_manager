#!/usr/bin/env sh
set -eu

# The root preinstall script checks npm_config_user_agent, but pnpm 11 does not
# expose it to that lifecycle here. Skip lifecycle scripts, then rebuild the
# packages in pnpm-workspace.yaml that are allowed to run install scripts.
pnpm install --frozen-lockfile --ignore-scripts
pnpm rebuild @clerk/shared esbuild
