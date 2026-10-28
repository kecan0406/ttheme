# src/pictures

Decoding, drawing and fetching pictures.

- The `<palette>.conf` a picture's terminal reads has one grammar, owned by `conf.ts` (`CONF_KEYS`, `CONF_INCLUDE`, `CONF_OPTIONAL`, `CONF_DEPTH`). The kitty watcher and the WezTerm module read it through readers generated from the same constants (`confReaderPython`, `confReaderLua`), and the shell layer reads the same keys and its own metadata lines (`# picture`, `# credit`, `# source`, `# profile`). `conf.test.ts` and `src/terminals/conf-readers.test.ts` hold them together.
- `images.json` owns the pictures each palette keeps and which one is up, and only the CLI writes it; every `<palette>.conf` is a view regenerated from it.
- A picture's ink is how bright it is on a dark palette and how dark on a light one (`inkOf`). One whose palette changed mode is never recolored: `sync` swaps in the drawing of its other ink from the drawing cache, or draws it again (`inkDue`, `redrawPictures`), before the emitters run, so the terminals' files are written once.
- Anything a palette's `[[picture]]` lists is fetched only when the palette is newly installed or the list gained it (`since`), so a picture the user dropped stays dropped.
