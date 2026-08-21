# Frontend-only. Merged stack: docker compose → docker/Dockerfile
# See docker/README.md

ARG TOMCAT_IMAGE=9.0.118
ARG NODE_IMAGE=22-alpine

FROM node:${NODE_IMAGE} AS builder

WORKDIR /build
COPY package.json vite.config.mjs ./
COPY index.html ./
COPY eslint.config.js ./
COPY .htmlvalidate.json ./
COPY .stylelintrc.json ./
COPY LICENSE ./
COPY src ./src
COPY util ./util

RUN npm install --ignore-scripts && npm run release

FROM tomcat:${TOMCAT_IMAGE}-jre8-temurin-noble

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r tomcat --gid=999 \
    && useradd -r -g tomcat --uid=999 --home-dir="${CATALINA_HOME}" tomcat \
    && rm -rf "${CATALINA_HOME}/webapps/"* \
    && mkdir -p "${CATALINA_HOME}/webapps/ROOT" \
    && chown -R tomcat:tomcat "${CATALINA_HOME}"

COPY --from=builder --chown=tomcat:tomcat /build/deploy/ ${CATALINA_HOME}/webapps/ROOT/

USER tomcat

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/ || exit 1

CMD ["catalina.sh", "run"]
