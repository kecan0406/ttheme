---
name: lessons
description: Decide where a lesson goes before writing it down — a correction from the user, a mistake that came back, a trap found while working, a rule someone asks you to remember — among the AGENTS.md files, .claude/rules, a skill, a test, docs/ and the commit body, so the instruction files hold rules and never turn into a log. Use when the user corrects an approach or asks you to learn or remember something for the repository, and before adding or changing a line in any AGENTS.md, .claude/rules file or SKILL.md.
metadata:
  internal: true
---

# Where a lesson goes

A lesson is written once, in the smallest place that holds it. Most lessons go into no instruction file at all.

## 1. Search first

`git grep` the lesson in the `AGENTS.md` files, `.claude/rules/`, `.agents/skills/` and `docs/`, and `git log --grep` it in the commit bodies. Where a line already says it, change that line instead of adding one beside it.

## 2. Pick one place

| The lesson | Goes to |
|---|---|
| A preference for the task in hand | nowhere |
| A preference of the person you work for that the repository does not share | their own memory or settings |
| A mistake made for the first time | the fixing commit's body |
| A bug that must not come back | a regression test beside the code |
| What a terminal does | a compat case in `tests/compat/cases.zsh`, then the parity model |
| What ttheme does, changed by a feature | the code, its tests and `docs/` |
| What a user runs or sees | its page in `docs/` |
| How a screen, a message or a docs page is worded | `.claude/rules/text.md` |
| A rule for one folder, once the same mistake happened twice | the `AGENTS.md` in that folder |
| A trap the code cannot show in files across folders, once it cost a mistake twice | the `.claude/rules` file whose `paths` cover them |
| A procedure with steps and commands | a skill in `.agents/skills/` |
| A measurement, a date, a version, a reason, how it used to be | the commit body |

"Twice" is read from the commit bodies, or the person you work for asks for the line.

## 3. Write it as a rule

- One sentence that says what to do or not do.
- No reason, number, version, date, issue or history.
- The principle, not the incident: no symbol, path or line number unless the rule is about it.
- One rule lives in one file; anywhere else points to it.
- A budget in `tests/agents.ts` is a ceiling: near it, merge or drop lines before adding one.

## 4. Before the change leaves your hands

- Every path and name the line mentions exists.
- The lines the new one replaces or contradicts are gone.
- The commit body says why the line was added.
