#!/bin/bash

source "$(dirname "$0")/utils.sh"

# Query 1Password for OPENVPN_USER and OPENVPN_PASSWORD
mkdir -p ./temp
SECRET_NAME="PrivateInternetAccess.com"
TEMP_FILE=./temp/pia.json
op item get $SECRET_NAME --format=json --vault=Homelab > $TEMP_FILE

OPENVPN_USER=$(jq -r '.fields[] | select(.id=="username") | .value' $TEMP_FILE)
OPENVPN_PASSWORD=$(jq -r '.fields[] | select(.id=="password") | .value' $TEMP_FILE)

rm $TEMP_FILE

# Check if the values were retrieved successfully
if [ -z "$OPENVPN_USER" ] || [ -z "$OPENVPN_PASSWORD" ]; then
    echo "Failed to retrieve OpenVPN credentials from 1Password."
    exit 1
fi

# Update or add the values in the .env file
update_env_file .env "OPENVPN_USER" "$OPENVPN_USER"
update_env_file .env "OPENVPN_PASSWORD" "$OPENVPN_PASSWORD"

# Password can be hard-coded as its not exposed to the internet and the container is only accessible during testing
update_env_file .env "QBITTORRENT_PASSWORD" "Password123"

echo ".env file created successfully."