PROJECT_DIR=apps/
PROJECT=pi-led-api

docker build \
    -t pi-led-api \
    -f ../../docker/node-18-pnpm-turbo-dev.Dockerfile \
    --build-arg PROJECT_DIR=$PROJECT_DIR \
    --build-arg PROJECT=$PROJECT \
    ../../