export class ToolInputError extends Error {
  readonly status = 400;
  readonly code = "INVALID_TOOL_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export class ToolExecutionError extends Error {
  readonly status = 422;

  constructor(
    message: string,
    readonly code = "TOOL_EXECUTION_FAILED",
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
