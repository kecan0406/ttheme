FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    konsole xvfb xdotool imagemagick dbus dbus-x11 x11-utils zsh sqlite3 procps \
    curl ca-certificates xz-utils unzip fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
ARG NODE=v22.23.3
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') \
  && curl -fsSL https://nodejs.org/dist/$NODE/node-$NODE-linux-$arch.tar.xz | tar -xJ -C /opt \
  && ln -s /opt/node-$NODE-linux-$arch/bin/node /usr/local/bin/node
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
ENV PATH=/root/.bun/bin:$PATH LANG=C.UTF-8 TMPDIR=/tmp
WORKDIR /work
