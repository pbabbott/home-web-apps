# Dev Environment - Main

The purpose of this document is to explain how one can configure their dev environment variables with the devcontainer.

## Procedure

### Step 1 - Create an .env file

```sh
cp ./.devcontainer/devcontainer.env ./.devcontainer/.env
```

### Step 2 - Update secret values

While there are some reasonable defaults in the sample file, be sure to update secretive values in the newly created `./.devcontainer/.env` file.

> [!NOTE]
> This `.env` file will be ignored by `git`

### Step 3 - Rebuild the devcontainer

Command Palette > `Dev Containers: Rebuild Container`
