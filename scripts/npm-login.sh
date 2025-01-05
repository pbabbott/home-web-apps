#!/bin/bash

set -e

if [ -z "$NPM_USERNAME" ] || [ -z "$NPM_PASSWORD"]; then
    echo "Environment variables NPM_USERNAME, NPM_PASSWORD are not set"
    echo "Fetching values from 1Password..."
    # Fetch docker username and password from 1Password
    NPM_USERNAME=$(op item get "verdaccio.local.abbottland.io - pbabbott" --field username)
    NPM_PASSWORD=$(op item get "verdaccio.local.abbottland.io - pbabbott" --field password --reveal)
else
    echo "Environment variables NPM_USERNAME, NPM_PASSWORD are set"
fi

# Perform NPM login using expect
expect <<EOF
spawn pnpm login --registry=https://verdaccio.local.abbottland.io
expect "Username:"
send "$NPM_USERNAME\r"
expect "Password:"
send "$NPM_PASSWORD\r"
expect eof
EOF