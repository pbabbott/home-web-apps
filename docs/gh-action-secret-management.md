# GH Action - Secret Management

The purpose of this document is to explain how secrets can be managed across the GH Actions in this project.

# The Setup

## Overview

This project is set up to work with 1Password. Within my homelab infra, there exists a 1Password Connect Server that is able to provide secrets, given that you have a token (`OP_CONNECT_TOKEN`). To maintain a high level of consistency over secret management, all secrets should be put into 1Password and then accessed via the connect server, including from the GH Actions runners.

## GH Action Secrets

This documentation from Github "[Using Secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)" explains how one can configure secrets more generally.

In this repository pbabbott/home-web-apps, under settings, you can [manage secrets for GH Actions for this repository.](https://github.com/pbabbott/home-web-apps/settings/secrets/actions)

If all goes well, there should only be one secret: `OP_CONNECT_TOKEN` as this can enable the `op` cli to fetch other secrets.

## Rotation

For more information on this secret `OP_CONNECT_TOKEN` please refer the repository [pbabbott/home-kubernetes](https://github.com/pbabbott/home-kubernetes) as its rotation instructions are co-located with information on the connect server.
