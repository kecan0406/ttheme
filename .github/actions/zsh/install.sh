#!/bin/sh
mkdir -p ~/zsh-debs && cd ~/zsh-debs || exit 1
cached() { ls zsh_*.deb zsh-common_*.deb > /dev/null 2>&1; }
cached ||
  { rm -f ./*.deb; apt-get download zsh zsh-common && cached; } ||
  { rm -f ./*.deb; sudo apt-get update && apt-get download zsh zsh-common && cached; } ||
  rm -f ./*.deb
sudo cp ./*.deb /var/cache/apt/archives/ 2> /dev/null
sudo apt-get install -y zsh || { sudo apt-get update && sudo apt-get install -y zsh; } || exit 1
cached || { cd && rmdir ~/zsh-debs; }
command -v tmux > /dev/null && command -v sqlite3 > /dev/null ||
  sudo apt-get install -y tmux sqlite3 ||
  { sudo apt-get update && sudo apt-get install -y tmux sqlite3; }
