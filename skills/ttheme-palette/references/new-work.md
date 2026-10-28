# A character the commons does not hold

When the commons does not hold the character, pass `--work <id>`: the work's id is its English title as fans write it, short form where one is common, in lowercase letters, digits and single hyphens (`frieren`, `bocchi-the-rock`) — `~/.config/ttheme/commons.json` lists the works the commons holds (`works`, each an `id` and a `name`), so use the id there when the work is one of them. For a work the commons lacks, add `--work-name "<English title>"` and `--work-native "<official title>"`. `make` then writes the character, or the whole work, into the user's marketplace's `works/` folder, where it shows as any other until the commons takes it in.

`native_names`, the character's names in its original language, is recorded only for a character the commons does not hold yet, so give it in the anchors for every such character.
