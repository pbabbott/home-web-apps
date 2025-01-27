#!/bin/bash

set -e

if [ -z "$NPM_USERNAME" ] || [ -z "$NPM_PASSWORD"]; then
    echo "Environment variables NPM_USERNAME, NPM_PASSWORD are not set"
    echo "Fetching values from 1Password..."
    # Fetch docker username and password from 1Password
    mkdir -p ./temp
    TEMP_FILE=./temp/verdaccio.json
    op item get "verdaccio.local.abbottland.io" --format=json --vault=Homelab > $TEMP_FILE

    NPM_USERNAME=$(jq -r '.fields[] | select(.id=="username") | .value' $TEMP_FILE)
    NPM_PASSWORD=$(jq -r '.fields[] | select(.id=="password") | .value' $TEMP_FILE)

    rm $TEMP_FILE

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