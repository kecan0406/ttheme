FROM --platform=linux/amd64 ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb xdotool imagemagick x11-utils dbus zsh sqlite3 procps curl ca-certificates xz-utils unzip fonts-dejavu-core \
    libgl1-mesa-dri libegl1 libegl-mesa0 libglx-mesa0 libxkbcommon-x11-0 \
  && rm -rf /var/lib/apt/lists/*
ARG CONTOUR=0.8.0.9335
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/contour.deb https://github.com/contour-terminal/contour/releases/download/v$CONTOUR/contour-$CONTOUR-ubuntu26.04-amd64.deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/contour.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/contour.deb
RUN chsh -s /usr/bin/zsh root
RUN apt-get update && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 5 --retry-all-errors https://bun.sh/install | bash -s "bun-v1.3.14"
ENV PATH=/root/.bun/bin:$PATH LANG=C.UTF-8 TMPDIR=/tmp TTHEME_COMPAT_IMAGE=contour
WORKDIR /work
