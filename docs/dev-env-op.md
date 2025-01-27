# Dev Environment: One Password

The purpose of this document is to explain what is needed to setup 1password (`op`) with the devcontainer.

## Overview

Most all secrets that are needed have been set up in 1Password.  In my homelab, there is a 1Password connect server that is able to provide secrets given that you have a token.  Before I had set up this connect server, I was using the `"Setup another device"` strategy which does not work well with devcontainers, as anytime the container rebuilds, you have to go through a bunch of steps to add another device.

# Procedure

Follow these steps to authenticate with 1password. Then you can run other commands & scripts that require 1Password authentication!

## Step 1 - Obtain the 1password token

The first step is to get the token from 1Password, this will require signing in with the 1password UI on an approved device.

Then, find the secret called `Production Access Token: Kubernetes`

## Step 2 - Update `.env`

Now, with the token, you can set the value in `.devcontainer/.env` finding the value `OP_CONNECT_TOKEN`
This token is set up to work in tandem with `OP_CONNECT_HOST`

### Step 3 - Run other scripts

Run other scripts that may require 1Password.  Environment variables are now automatically set with values from the vault!

