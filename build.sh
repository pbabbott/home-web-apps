docker build \
 -f ./docker/medium.Dockerfile \
 --build-arg PROJECT=gluetun-sync \
 -t gluetun-sync:latest \
 .