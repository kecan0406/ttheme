# Linux terminals, on a private display

The window scripts are macOS's. On Linux, `mise run sandbox --behind` with `--konsole`, `--kitty`, `--alacritty`, `--wezterm`, `--warp`, `--rio`, `--contour` or none (Ghostty) starts that terminal from its binary on `PATH` on its own Xvfb display (`TTHEME_XVFB_DISPLAY`), so nothing shows on the user's screen.

- Konsole gets its own D-Bus session, and needs `konsole`, `dbus-run-session`, `Xvfb` and `xdotool`.
- Warp is refused while another Warp runs.
- `mise run compat konsole` and `mise run compat --linux` drive the same terminals inside a container; on macOS that is the way to measure them with no window.
