# Dev Environment - Cluster Access

The purpose of this document is to explain how one can gain access to the kubernetes cluster. This is a necessary step as it enables development of some of the applications that can only be developed within the cluster (ie not within this container).

## Procedure

> [!IMPORTANT]
> These steps require that you have completed the [Dev Environment configuration steps for One Password](./dev-env-op.md)

### Step 1- Obtain kubeconfig file

First, you'll need to obtain a kubeconfig file. There is a script for this which fetches it from 1Password and puts it in the proper directory. (`~/.kube/config`)

```sh
./scripts/cluster-access.sh
```

> [!NOTE]
> This script can be used in a github action to enable cluster access as well!

### Step 2 - Switch namespace

You'll want to make sure you're using the development namespace. Right now there's just one and it can be accessed via:

```sh
kubens brandon-dev
```

### Step 3 - Celebrate

You can now run kubectl commands to see the status of various kubernetes resources. You can also develop apps that require skaffold to be in place.
