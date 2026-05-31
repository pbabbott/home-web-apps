FROM mcr.microsoft.com/playwright:v1.57.0-noble

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
