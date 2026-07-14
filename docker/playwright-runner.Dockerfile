FROM mcr.microsoft.com/playwright:v1.61.1-noble

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
