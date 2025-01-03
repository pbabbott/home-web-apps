# Dev Environment: One Password

The purpose of this document is to explain what is needed to setup 1password (`op`) with the devcontainer.

# Procedure

## Step 1 
Sign into 1password

```sh
eval $(op signin)
```

This will generate environment variables needed to run subsequent commands.

Values can be obtained via the 1password menun: `Setup another Device`

## Step 2

Run other scripts that may require 1Password now that your environment variables are automatically set!

