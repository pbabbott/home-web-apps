# Connect to a Docker Registry

In order to work with this project and containers, you'll want to connect to a container registry.  This guide explains how to setup a registry on your local development machine, or how to connect to a registry on the network.

## Environment Variables




## Local Registry

```
docker run -d -p 5000:5000 --restart=always --name registry registry:2
```

## Network Registry
