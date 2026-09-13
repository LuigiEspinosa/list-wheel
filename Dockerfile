# Two stages, in the Anchor's shape (cuatro-portfolio/docker/Dockerfile): one
# builds, one serves, and the served image carries no node at all.
#
# The build stage needs HTTPS egress. `src/index.html` links a Google Fonts
# stylesheet and `ng build` inlines that CSS into the output at build time, so a
# build with no route to fonts.googleapis.com fails rather than degrades. That
# is the same egress the GitHub Pages build had; it is stated here because the
# build now runs on the box, a knowing breach of the estate's AD-8 recorded as
# KV-1 in cuatro-portfolio's ops/known-violations.md and retired by Story 4.3.
#
# `node:22-slim`: @angular/cli 20.3 requires node ^20.19 || ^22.12 || >=24, and
# 22 is the Anchor's base. Floating major, like every image in the estate.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `npm run build` is the production configuration (angular.json's
# defaultConfiguration) with `<base href="/">` from src/index.html. The
# `/list-wheel/` base the Pages deploy carried came only from the deleted
# `deploy` script's flag, never from the source.
RUN npm run build

# `caddy:2` because it is the estate's ingress image: the one Caddy on the box
# already runs it, so serving the static output from the same image adds no
# second server flavour to reason about. Floating major, like the build stage.
# docker/Caddyfile is the container's own :80 server, not the public site
# block; the comment there says where that lives.
FROM caddy:2
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/list-wheel/browser /srv
