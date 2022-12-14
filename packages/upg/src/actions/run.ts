import prompts from "prompts";

import { performance } from "perf_hooks";

import { createShell } from "universal-shell";
import { rm } from "fs/promises";

import { Action } from "./types";
import { style, warn } from "@tsmodule/log";
import { useTempFile } from "../utils/useTempFile";

export const EXECUTION_COMMANDS = {
  bash: "bash",
  zsh: "zsh",
  python: "python",
  javascript: "node",
  typescript: "tsmodule",
  // typescript: `ts-node -O ${JSON.stringify({ lib: ["dom", "esnext"] })}`,
};

export const PLATFORM_EXTENSIONS = {
  bash: "sh",
  zsh: "zsh",
  python: "py",
  javascript: "js",
  typescript: "ts",
};

export const PLATFORMS = Object.keys(EXECUTION_COMMANDS);
export const EXTENSIONS = Object.values(PLATFORM_EXTENSIONS);

export const run: Action = async (state) => {
  if (!state || !state.code) {
    throw new Error("Nothing to run.");
  }

  const { code } = state;
  let { target } = state;

  const shell = createShell({
    stdio: ["inherit", "pipe", "pipe"],
    log: true,
  });

  let fileExtension: string;
  if (target && EXTENSIONS.includes(target)) {
    fileExtension = target;
  } else if (target && PLATFORMS.includes(target)) {
    const targetPlatform = target as keyof typeof PLATFORM_EXTENSIONS;
    fileExtension = PLATFORM_EXTENSIONS[targetPlatform];
  } else {
    const { extension } = await prompts({
      type: "text",
      name: "extension",
      message: "What file extension should be used?",
    });
    fileExtension = extension;
  }

  /**
   * Ensure file extensions don't start with a dot.
   */
  if (fileExtension.startsWith(".")) {
    fileExtension = fileExtension.replace(/^\.+/, "");
  }

  /**
   * Ensure the target matches the inferred platform.
   */
  for (const [platform, extension] of Object.entries(PLATFORM_EXTENSIONS)) {
    if (fileExtension === extension) {
      target = platform;
    }
  }

  const tempfile = await useTempFile(code, fileExtension);

  let command: string;
  if (target && PLATFORMS.includes(target)) {
    command = EXECUTION_COMMANDS[target as keyof typeof EXECUTION_COMMANDS];
  } else {
    const { command: promptCommand } = await prompts({
      type: "text",
      name: "command",
      message: "What command should be called to execute this program as a file? (e.g. 'node', 'python', 'bash')",
    });

    command = promptCommand;
  }

  if (!command) {
    throw new Error("No execution command provided.");
  }

  warn(
    style("-".repeat(30), ["dim"]) + "\n" +
    style("Output", ["bold", "dim"]) + "\n" +
    style("-".repeat(30), ["dim"]),
    [],
    { preLines: 1 },
  );

  const startTime = performance.now();
  const { code: exitCode, stdout, stderr } = await shell.run(`${command} ${tempfile}`);
  const endTime = performance.now();
  const duration = endTime - startTime;

  warn("-".repeat(30), ["dim"]);

  const failed = exitCode !== 0;
  warn(
    style(`${command} exited with code ${exitCode}.`, ["dim", failed ? "red" : "green"]) + "\n" +
    `Execution time: ${duration.toFixed(2)}ms`,
  );

  /**
   * Remove the tempfile.
   */
  await rm(tempfile);

  const lastRun = {
    exitCode,
    stderr,
    stdout,
  };

  return {
    ...state,
    lastRun,
  };
};