# Dev Guide - Cluster Access

The purpose of this document is to explain how you can obtain a kubeconfig file directly from the cluster controllers and then store it in 1Password for use by home-web-apps.

> [!NOTE]
> This is an **admin workflow** for when the kubeconfig needs to be refreshed at the source.
> For the routine developer workflow (fetching the already-stored kubeconfig from 1Password), see [Dev Environment - Cluster Access](./dev-env-cluster-access.md).

## Procedure

This process is meant to be done once the cluster is provisioned and a kubeconfig file has been set up on the controllers. With the kubeconfig obtained, it is saved to 1Password where applications and developers can fetch it on demand.

### Step 1 - Obtain kubeconfig file

Run the script from this repo to SCP the kubeconfig from each controller, merge them, and write to `~/.kube/config`:

```sh
./scripts/get-kube-config-file.sh
```

### Step 2 - Copy the file contents

```sh
cat ~/.kube/config
```

Copy the contents to your clipboard.

### Step 3 - Write to a file

On your host machine, open VS Code, paste the contents into a new file called `config` and write it to your desktop.

### Step 4 - Use the 1Password UI

Open the 1Password UI and find the secret in the `Homelab` vault called `Kubeconfig Admin`.

This secret is of type `document` and expects one file named `config`. Replace the file.

### Step 5 - Celebrate

Now `home-web-apps` can access the cluster! Wahoo!
