/**
 * Parses a single V8/Node stack-frame line into its fields.
 *
 * V8 frames come in three shapes:
 *
 *   at functionName (file:line:col)   // function name present
 *   at file:line:col                  // anonymous (eval/module-level)
 *   at eval (file:line:col)           // eval, name not recoverable
 *
 * The location triple is always the parenthesised chunk at the end (or the
 * trailing token when no parens exist).  File paths on Windows contain
 * colons in the drive letter (C:\...), so the ONLY colons that separate
 * line and column are the final two colons of the location string.  We split
 * from the right rather than from the left to survive C:\ and posix paths
 * alike.
 *
 * Decision: if a line is not recognisable as one of the three shapes above
 * we return null rather than throw.  A stack trace is diagnostic best-effort
 * data; one unparseable line should not discard the rest of a trace.
 *
 * @param {string} line  A single line from `new Error().stack`.
 * @returns {{
 *   functionName: string|null,
 *   file: string|null,
 *   line: number|null,
 *   column: number|null
 * } | null}
 */
export function parseStackFrame(line) {
  if (typeof line !== 'string') return null;

  const trimmed = line.trim();
  if (trimmed === '') return null;

  // Accept lines with or without a leading "at ".  `Error: msg\n    at ...`
  // always carries the prefix, but being lenient costs nothing and keeps the
  // parser usable on fragments.
  let body = trimmed;
  if (body.startsWith('at ')) {
    body = body.slice(3).trim();
  }
  if (body === '') return null;

  const parenOpen = body.indexOf('(');
  const parenClose = body.lastIndexOf(')');

  let functionName = null;
  let location = null;

  if (parenOpen !== -1 && parenClose === body.length - 1 && parenOpen < parenClose) {
    // Shape: functionName (file:line:col)
    functionName = body.slice(0, parenOpen).trim();
    location = body.slice(parenOpen + 1, parenClose).trim();
  } else if (parenOpen === -1 && parenClose === -1) {
    // Shape: file:line:col   (no parens)
    location = body;
  } else {
    // Malformed mix of parens — refuse to guess.
    return null;
  }

  // "eval" as a function name is not a real function name; V8 emits it as a
  // placeholder when the frame is inside eval.  We surface it as null so
  // callers can distinguish "named function" from "synthetic marker".
  if (functionName === 'eval' || functionName === '<anonymous>') {
    functionName = null;
  }

  // Split the location from the right: file paths may contain colons (C:\).
  // The final two colon-separated tokens are line and column.
  const lastColon = location.lastIndexOf(':');
  if (lastColon === -1) return null;

  const secondLastColon = location.lastIndexOf(':', lastColon - 1);
  if (secondLastColon === -1) return null;

  const file = location.slice(0, secondLastColon);
  const lineStr = location.slice(secondLastColon + 1, lastColon);
  const colStr = location.slice(lastColon + 1);

  if (file === '' || lineStr === '' || colStr === '') return null;

  // parseInt accepts leading '+', surrounding whitespace, and trailing
  // non-digits, all of which would mask a malformed frame.  Require a strict
  // digit run instead.
  if (!/^\d+$/.test(lineStr) || !/^\d+$/.test(colStr)) return null;

  const lineNum = parseInt(lineStr, 10);
  const colNum = parseInt(colStr, 10);

  return {
    functionName: functionName === '' ? null : functionName,
    file,
    line: lineNum,
    column: colNum,
  };
}
