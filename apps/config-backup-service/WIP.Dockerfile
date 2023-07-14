# home-config-backup-service 
# Single stage - Dev Runtime
FROM node:18-lts

WORKDIR /app

ADD package.json yarn.lock ./

ENV NODE_ENV development

RUN yarn --frozen-lockfile 

COPY . .

CMD [ "yarn", "start:dev" ]


# Dockerfile.prod
# Stage 1 - Use dev image to do a build
ARG BASE_IMAGE
FROM $BASE_IMAGE as build

RUN yarn build

# Stage 2 - Production Runtime
FROM gcr.io/distroless/nodejs18-lts

WORKDIR /app

COPY --from=build /app/package.json ./

ARG PORT
EXPOSE PORT

CMD ["lib/index.js"]