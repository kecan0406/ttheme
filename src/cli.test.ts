import assert from "node:assert/strict";
import { test } from "node:test";
import { CommanderError } from "commander";
import { TERMINALS } from "./build.ts";
import { createProgram } from "./cli.ts";

function makeProgram() {
  const program = createProgram();
  for (const cmd of [program, ...program.commands]) {
    cmd.configureOutput({ writeOut() {}, writeErr() {} });
  }
  return program;
}

async function parseError(argv: string[]): Promise<CommanderError> {
  try {
    await makeProgram().parseAsync(argv, { from: "user" });
  } catch (error) {
    assert.ok(error instanceof CommanderError);
    return error;
  }
  assert.fail("expected a CommanderError");
}

test("build --only rejects unknown terminals", async () => {
  const error = await parseError(["build", "--only", "vscode"]);
  assert.equal(error.code, "commander.invalidArgument");
});

test("build --only offers every terminal", () => {
  assert.deepEqual(TERMINALS, [
    "ghostty",
    "kitty",
    "alacritty",
    "wezterm",
    "iterm2",
  ]);
});

test("unknown commands fail with a usage error", async () => {
  const error = await parseError(["paint"]);
  assert.equal(error.code, "commander.unknownCommand");
});

test("--version exits cleanly through exitOverride", async () => {
  const error = await parseError(["--version"]);
  assert.equal(error.exitCode, 0);
});
