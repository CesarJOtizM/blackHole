FROM node:24-bookworm-slim

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-cloud/package.json apps/api-cloud/package.json
COPY contexts/platform/package.json contexts/platform/package.json
COPY shared/contracts/package.json shared/contracts/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ENV API_COMMAND="apps/api-cloud/src/main.ts" \
    WORKER_COMMAND="apps/api-cloud/src/worker.ts"

ENTRYPOINT ["node", "--experimental-strip-types"]
CMD ["apps/api-cloud/src/main.ts"]
