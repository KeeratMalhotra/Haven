import React from "react";

/**
 * Jest mock for the ESM-only `react-markdown` package.
 *
 * `react-markdown` ships as native ESM, which the project's `ts-jest` transform
 * (configured only for `.ts`/`.tsx`) does not process, causing a
 * "SyntaxError: Unexpected token 'export'" when imported in tests. Tests do not
 * assert on rendered markdown internals, so this stub simply renders the raw
 * content, preserving the component contract.
 */
export default function ReactMarkdown({
  children,
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return <>{children}</>;
}
