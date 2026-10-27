# What is ttheme

ttheme gives your terminal the colors of a character you love. Each tab can
show its own palette, every built-in palette passes contrast checks, and one
command takes it all back out.

## What it does

- **A palette per tab.** Use one palette in this tab and another in the next,
  set the one new tabs open with, or let each new tab take the next character.
- **Readable by rule.** Every built-in palette keeps body text at 7:1 against
  its background and every meaningful ANSI color at 4.5:1, and red still reads
  as an error and green as success.
- **Light and dark.** Every palette comes in both modes, and `auto` follows
  your system where the terminal reports its appearance.
- **Places of their own.** A folder, a repository or an ssh host can pin a
  palette, so `cd` or `ssh` there shows it and leaving puts back what the tab
  showed.
- **Colors only.** ttheme sets no font, font size or shader, and adds one
  guarded line to each config it wires.

## Words you will meet

| Word | Means |
|---|---|
| palette | twenty colors: background, foreground, cursor, selection and the 16 ANSI colors |
| work | a series, a game or a franchise; palettes of it and its characters sit on its shelf |
| original | a palette of no work or character |
| built-in | the palettes that ship inside ttheme, named `ttheme/<palette>` |
| marketplace | a GitHub repository or a folder of palettes, named `<owner>@<name>` |
| default | the palette new tabs open with |
| pin | a palette tied to a folder or an ssh host |
| mode | `light`, `dark` or `auto`: how every palette shows |
| picture | a picture of the character behind your text, fetched to your machine |
| tuning | your changes to a palette that is not yours, kept apart from it |

## Where to go next

| To | Read |
|---|---|
| install ttheme and pick a palette | [Quick start](quickstart.md) |
| see every question `init` asks | [Install](install.md) |
| try palettes on and keep one | [Your first palette](first-palette.md) |
| know what `init` changed, and undo it | [What changed](what-changed.md) |
| fix something that went wrong | [Troubleshooting](troubleshooting.md) |
| check what your terminal can show | [Terminal support](../reference/terminals.md) |
