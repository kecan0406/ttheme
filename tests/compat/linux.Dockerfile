FROM ubuntu:26.04 AS zig
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates xz-utils git pkg-config gettext libxml2-utils meson ninja-build \
    python3 python3-gi gir1.2-gtk-4.0 gir1.2-adw-1 libgtk-4-dev libadwaita-1-dev libgtk4-layer-shell-dev \
  && rm -rf /var/lib/apt/lists/*

FROM zig AS ghostty
ARG GHOSTTY=1.3.1
ARG ZIG=0.15.2
RUN curl -fsSL --retry 5 --retry-all-errors https://ziglang.org/download/$ZIG/zig-$(uname -m)-linux-$ZIG.tar.xz | tar -xJ -C /opt
WORKDIR /src
RUN curl -fsSL --retry 5 --retry-all-errors https://release.files.ghostty.org/$GHOSTTY/ghostty-$GHOSTTY.tar.gz | tar -xz --strip-components=1 \
  && /opt/zig-$(uname -m)-linux-$ZIG/zig build -Doptimize=ReleaseFast -Dcpu=baseline --prefix /opt/ghostty

FROM zig AS ghostty-tip
ARG GHOSTTY_TIP=c7cbc9bfd44cb11a9c7eae00f1166624671e363b
ARG ZIG=0.16.0
ARG BLUEPRINT=v0.20.4
RUN git clone -q --depth 1 --branch $BLUEPRINT https://gitlab.gnome.org/GNOME/blueprint-compiler.git /tmp/blueprint \
  && meson setup /tmp/blueprint/build /tmp/blueprint --prefix=/usr/local && meson install -C /tmp/blueprint/build
RUN curl -fsSL --retry 5 --retry-all-errors https://ziglang.org/download/$ZIG/zig-$(uname -m)-linux-$ZIG.tar.xz | tar -xJ -C /opt
WORKDIR /src
RUN git init -q && git remote add origin https://github.com/ghostty-org/ghostty.git \
  && git fetch -q --depth 1 origin $GHOSTTY_TIP && git checkout -q FETCH_HEAD \
  && /opt/zig-$(uname -m)-linux-$ZIG/zig build -Doptimize=ReleaseFast -Dcpu=baseline --prefix /opt/ghostty-tip

FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb xdotool imagemagick x11-utils dbus zsh sqlite3 procps curl ca-certificates xz-utils unzip gpg fonts-dejavu-core \
    libgl1-mesa-dri libegl1 libegl-mesa0 libglx-mesa0 mesa-vulkan-drivers libvulkan1 libxkbcommon-x11-0 libasound2t64 \
    libgtk-4-1 libadwaita-1-0 libgtk4-layer-shell0 alacritty \
  && rm -rf /var/lib/apt/lists/*
COPY --from=ghostty /opt/ghostty /opt/ghostty
COPY --from=ghostty-tip /opt/ghostty-tip /opt/ghostty-tip
RUN ln -s /opt/ghostty/bin/ghostty /usr/local/bin/ghostty \
  && ! ldd /opt/ghostty/bin/ghostty /opt/ghostty-tip/bin/ghostty | grep 'not found'
ARG KITTY=0.49.2
RUN mkdir -p /opt/kitty \
  && curl -fsSL --retry 5 --retry-all-errors https://github.com/kovidgoyal/kitty/releases/download/v$KITTY/kitty-$KITTY-$(uname -m | sed 's/aarch64/arm64/').txz | tar -xJ -C /opt/kitty \
  && ln -s /opt/kitty/bin/kitty /opt/kitty/bin/kitten /usr/local/bin/
RUN arch=$(dpkg --print-architecture) \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/wezterm.deb https://github.com/wezterm/wezterm/releases/download/nightly/wezterm-nightly.Ubuntu24.04$([ "$arch" = amd64 ] || echo ".$arch").deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/wezterm.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/wezterm.deb
ARG WARP=0.2026.10.21.08.25.stable.02
RUN mkdir -p /etc/apt/keyrings \
  && curl -fsSL --retry 5 --retry-all-errors https://releases.warp.dev/linux/keys/warp.asc | gpg --dearmor > /etc/apt/keyrings/warpdotdev.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/warpdotdev.gpg] https://releases.warp.dev/linux/deb stable main" > /etc/apt/sources.list.d/warpdotdev.list \
  && apt-get update && apt-get install -y --no-install-recommends warp-terminal=$WARP \
  && rm -rf /var/lib/apt/lists/*
ARG RIO=0.5.28
RUN arch=$(dpkg --print-architecture) \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/rio.deb https://github.com/raphamorim/rio/releases/download/v$RIO/rioterm_${RIO}_${arch}_x11.deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/rio.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/rio.deb
RUN chsh -s /usr/bin/zsh root
ARG NODE=v22.23.3
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') \
  && curl -fsSL --retry 5 --retry-all-errors https://nodejs.org/dist/$NODE/node-$NODE-linux-$arch.tar.xz | tar -xJ -C /opt \
  && ln -s /opt/node-$NODE-linux-$arch/bin/node /usr/local/bin/node
RUN curl -fsSL --retry 5 --retry-all-errors https://bun.sh/install | bash -s "bun-v1.3.14"
ENV PATH=/root/.bun/bin:$PATH LANG=C.UTF-8 TMPDIR=/tmp TTHEME_COMPAT_IMAGE=linux
WORKDIR /work
