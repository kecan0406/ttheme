FROM ubuntu:26.04 AS zig
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates xz-utils git pkg-config gettext libxml2-utils meson ninja-build \
    python3 python3-gi gir1.2-gtk-4.0 gir1.2-adw-1 libgtk-4-dev libadwaita-1-dev libgtk4-layer-shell-dev libegl-dev \
  && rm -rf /var/lib/apt/lists/*

FROM zig AS ghostty
ARG GHOSTTY=1.4.0
ARG ZIG=0.17.0
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/zig.tar.xz https://ziglang.org/download/$ZIG/zig-$(uname -m)-linux-$ZIG.tar.xz \
  && tar -xJf /tmp/zig.tar.xz -C /opt && rm /tmp/zig.tar.xz
WORKDIR /src
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/ghostty.tar.gz https://release.files.ghostty.org/$GHOSTTY/ghostty-$GHOSTTY.tar.gz \
  && tar -xzf /tmp/ghostty.tar.gz --strip-components=1 && rm /tmp/ghostty.tar.gz \
  && /opt/zig-$(uname -m)-linux-$ZIG/zig build -Doptimize=ReleaseFast -Dcpu=baseline --prefix /opt/ghostty

FROM ghostty AS ghostty-tip
ARG GHOSTTY_TIP=b2c78c9bd9bc88a16d9c3769b0fb17ddde1b78b1
ARG ZIG_TIP=0.17.0
ARG BLUEPRINT=v0.20.4
RUN git clone -q --depth 1 --branch $BLUEPRINT https://gitlab.gnome.org/GNOME/blueprint-compiler.git /tmp/blueprint \
  && meson setup /tmp/blueprint/build /tmp/blueprint --prefix=/usr/local && meson install -C /tmp/blueprint/build
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/zig.tar.xz https://ziglang.org/download/$ZIG_TIP/zig-$(uname -m)-linux-$ZIG_TIP.tar.xz \
  && tar -xJf /tmp/zig.tar.xz -C /opt && rm /tmp/zig.tar.xz
WORKDIR /tip
RUN git init -q && git remote add origin https://github.com/ghostty-org/ghostty.git \
  && git fetch -q --depth 1 origin $GHOSTTY_TIP && git checkout -q FETCH_HEAD \
  && /opt/zig-$(uname -m)-linux-$ZIG_TIP/zig build -Doptimize=ReleaseFast -Dcpu=baseline --prefix /opt/ghostty-tip

FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb xdotool imagemagick x11-utils dbus zsh sqlite3 procps curl ca-certificates xz-utils unzip fonts-dejavu-core \
    libgl1-mesa-dri libegl1 libegl-mesa0 libglx-mesa0 mesa-vulkan-drivers libvulkan1 libxkbcommon-x11-0 libasound2t64 \
    libgtk-4-1 libadwaita-1-0 libgtk4-layer-shell0 alacritty \
  && rm -rf /var/lib/apt/lists/*
ARG KITTY=0.49.2
RUN mkdir -p /opt/kitty \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/kitty.txz https://github.com/kovidgoyal/kitty/releases/download/v$KITTY/kitty-$KITTY-$(uname -m | sed 's/aarch64/arm64/').txz \
  && tar -xJf /tmp/kitty.txz -C /opt/kitty && rm /tmp/kitty.txz \
  && ln -s /opt/kitty/bin/kitty /opt/kitty/bin/kitten /usr/local/bin/
RUN arch=$(dpkg --print-architecture) \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/wezterm.deb https://github.com/wezterm/wezterm/releases/download/nightly/wezterm-nightly.Ubuntu24.04$([ "$arch" = amd64 ] || echo ".$arch").deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/wezterm.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/wezterm.deb
ARG WARP=0.2026.10.21.08.25.stable.02
RUN arch=$(dpkg --print-architecture) \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/warp.deb https://releases.warp.dev/stable/v${WARP%.*}_${WARP##*.}/warp-terminal_${WARP}_$arch.deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/warp.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/warp.deb /etc/apt/sources.list.d/warpdotdev.sources /etc/apt/trusted.gpg.d/warpdotdev.gpg
ARG RIO=0.5.28
RUN arch=$(dpkg --print-architecture) \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/rio.deb https://github.com/raphamorim/rio/releases/download/v$RIO/rioterm_${RIO}_${arch}_x11.deb \
  && apt-get update && apt-get install -y --no-install-recommends /tmp/rio.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/rio.deb
RUN chsh -s /usr/bin/zsh root
ARG NODE=v22.23.3
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') \
  && curl -fsSL --retry 5 --retry-all-errors -o /tmp/node.tar.xz https://nodejs.org/dist/$NODE/node-$NODE-linux-$arch.tar.xz \
  && tar -xJf /tmp/node.tar.xz -C /opt && rm /tmp/node.tar.xz \
  && ln -s /opt/node-$NODE-linux-$arch/bin/node /usr/local/bin/node
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/bun.sh https://bun.sh/install && bash /tmp/bun.sh "bun-v1.3.14" && rm /tmp/bun.sh
COPY --from=ghostty /opt/ghostty /opt/ghostty
COPY --from=ghostty-tip /opt/ghostty-tip /opt/ghostty-tip
RUN ln -s /opt/ghostty/bin/ghostty /usr/local/bin/ghostty \
  && ! ldd /opt/ghostty/bin/ghostty /opt/ghostty-tip/bin/ghostty | grep 'not found'
ENV PATH=/root/.bun/bin:$PATH LANG=C.UTF-8 TMPDIR=/tmp TTHEME_COMPAT_IMAGE=linux
WORKDIR /work
