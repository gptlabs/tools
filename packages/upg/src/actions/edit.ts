import { DOMAIN_URL } from "../globs/shared";

import prompts from "prompts";

import { diffLines } from "diff";
import { NullableAction } from "./types";
import { AUTH0_CLIENT } from "../globs/node";
import { error, success } from "@tsmodule/log";

export const edit: NullableAction<{ instruction?: string }> =
async (state, { instruction } = {}) => {
  if (!state || !state.code) {
    error("Nothing to edit.");
    return null;
  }

  const { code } = state;
  if (!instruction) {
    const { instruction: promptInstruction } = await prompts({
      type: "text",
      name: "instruction",
      message: "How should this program should be changed?",
    });

    instruction = promptInstruction;
  }

  if (!instruction) {
    error("No instruction provided.");
    return null;
  }

  const body = new URLSearchParams({ code, instruction });
  const response = await AUTH0_CLIENT.fetch(
    `${DOMAIN_URL}/api/edit`,
    {
      method: "POST",
      body,
    }
  ).then((res) => res.json()) as any;

  if (typeof response.code !== "string") {
    error("No code generated.");
    return null;
  }

  const editedCode = response.code.trim();
  const diff = diffLines(code, editedCode);

  success("Edited.", [], { preLines: 1 });
  return {
    ...state,
    code: editedCode,
    diff,
  };
};