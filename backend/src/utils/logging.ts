export const getErrorLogSummary = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }

  const code =
    "code" in error && typeof error.code === "string"
      ? ` code=${error.code}`
      : "";

  return `${error.name}${code}`;
};
