# config-backup-service

Service to compress and back up directories in a filesystem to a remote location on a specified schedule.  Also able to restore directories from a backup.

## Table of Contents

- [config-backup-service](#config-backup-service)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Examples](#examples)
- [Contributing](#contributing)
  - [Initial Setup](#initial-setup)
  - [Building](#building)
 
*Note:* This Table of Contents is managed by the VS Code Extension: `yzhang.markdown-all-in-one`

## Features

- Start the service by mounting directories and a config file
- Specify the config for backups in simple yaml format
- Check on the service at an API endpoint: `/healthz` 
- Get custom metrics on backups via prometheus endpoint: `/metrics`


## Examples

```
    docker run config-backup-service -d \
        -v /volume-to-back-up:/backups/directory_name \
        -v config.yml:/config/config.yml
```

```yaml
providers:
    - name: azure
      type: azure_storage
      target:
        AZURE_TENANT_ID: azureTenantId
        AZURE_SUBSCRIPTION_ID: azureSubscriptionId
        AZURE_USERNAME: azureSpUsername
        AZURE_PASSWORD: azureSpPassword
        AZURE_STORAGE_ACCOUNT_NAME: azureStorageAccountName
        AZURE_STORAGE_CONTAINER_NAME: azureStorageContainerName

backups:
    - dir: directory_name
      schedule: "0 2 * * *"
      provider: azure
```

# Contributing

All commands should be run from the root of this monorepo using NX.

## Initial Setup
Follow steps to:
- [Install NX](../../docs/nx_install.md)
- [Setup Artifact Repository](../../docs/artifact_repo.md)

Now you are ready to start developing on this project. 🎉

## Building

Run `nx build config-backup-service` to build the library.

