# Dev Environment: One Password

The purpose of this document is to explain what is needed to setup 1password (`op`) with the devcontainer.

# Procedure

These steps are largely optional. If you don't want to authenticate with 1Password, then you can just provide environment variables to `.devcontainer/.env` instead.

## Step 1 

Sign into 1Password

```sh
eval $(op signin)
```

This will generate environment variables needed to run subsequent commands.

Values can be obtained via the 1password menun: `Setup another Device`

## Step 2

Run other scripts that may require 1Password.  Environment variables are now automatically set with values from the vault!

