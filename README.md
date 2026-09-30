# Stack Frame Parser

Parses a single V8/Node.js stack-frame line into its function name, file, line number, and column number.

```js
import { parseStackFrame } from 'stack-frame-parser';

const frame = parseStackFrame('    at foo (/app/index.js:42:7)');
// { functionName: 'foo', file: '/app/index.js', line: 42, column: 7 }
```

## Why

Walking an `Error.stack` string line by line is common when you want to redact paths, attach source context, or build a structured log event. The format is stable enough to parse but has two shapes (with and without parentheses) and a Windows-path trap (`C:\...` contains a colon), which makes naive splitting from the left wrong on Windows. This library does one thing: takes one already-split line and returns a plain object, or `null` if the line is not a frame it recognises.

The deliberate trade-off is that it returns `null` for anything it cannot parse rather than throwing. Stack traces are diagnostic best-effort data; one unparseable line should not discard the rest of a trace.

## Edge cases you will hit

- **`eval` and `<anonymous>`** appear in V8's function-name slot but are not real names. This library normalises both to `null` so callers can distinguish "named function" from "synthetic marker".
- **Windows drive letters** (`C:\...`) survive because the location triple is split from the right: the final two colons always delimit line and column.
- Lines missing a line number or column number return `null`, as do lines with unbalanced parentheses or non-numeric position fields.

## Exports

- `parseStackFrame(line: string): { functionName: string | null, file: string | null, line: number | null, column: number | null } | null`

Run tests with `node --test`.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

