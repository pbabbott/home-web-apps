#!/bin/bash

set -e

mkdir -p ./temp
TEMP_FILE=./temp/kubeconfig

op read --out-file $TEMP_FILE "op://Homelab/Kubeconfig Admin/config"

mkdir -p ~/.kube
cp $TEMP_FILE ~/.kube/config

echo "Kubeconfig file written to ~/.kube/config"

kubens brandon-dev