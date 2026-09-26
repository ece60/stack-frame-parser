import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStackFrame } from '../src/index.js';

// A parse is considered a failure case when we return null.
function isNull(result) {
  return result === null;
}

test('named function with posix path', () => {
  const r = parseStackFrame('    at foo (/a/b/c.js:10:20)');
  assert.deepEqual(r, {
    functionName: 'foo',
    file: '/a/b/c.js',
    line: 10,
    column: 20,
  });
});

test('anonymous function (no parens)', () => {
  const r = parseStackFrame('    at /a/b/c.js:5:15');
  assert.deepEqual(r, {
    functionName: null,
    file: '/a/b/c.js',
    line: 5,
    column: 15,
  });
});

test('eval is reported as null function name', () => {
  const r = parseStackFrame('    at eval (eval at <anonymous> (/x.js:1:1) :1:5)');
  // The outermost parens contain the location; "eval at <anonymous>" is the
  // function-name slot, which we normalise to null.
  assert.equal(r.functionName, null);
  assert.ok(r.line === 1 && r.column === 5);
});

test('windows drive letter path survives right-split', () => {
  const r = parseStackFrame('    at foo (C:\\Users\\me\\app.js:42:7)');
  assert.deepEqual(r, {
    functionName: 'foo',
    file: 'C:\\Users\\me\\app.js',
    line: 42,
    column: 7,
  });
});

test('windows drive letter path, anonymous', () => {
  const r = parseStackFrame('    at C:\\dev\\app.js:3:9');
  assert.deepEqual(r, {
    functionName: null,
    file: 'C:\\dev\\app.js',
    line: 3,
    column: 9,
  });
});

test('method call dotted name', () => {
  const r = parseStackFrame('    at Object.foo (/a.js:1:2)');
  assert.equal(r.functionName, 'Object.foo');
  assert.equal(r.file, '/a.js');
});

test('leading "at " is optional', () => {
  const r = parseStackFrame('foo (/a.js:1:2)');
  assert.equal(r.functionName, 'foo');
  assert.equal(r.file, '/a.js');
});

test('empty input returns null', () => {
  assert.equal(parseStackFrame(''), null);
  assert.equal(parseStackFrame('   '), null);
});

test('non-string input returns null', () => {
  assert.equal(parseStackFrame(null), null);
  assert.equal(parseStackFrame(undefined), null);
  assert.equal(parseStackFrame(42), null);
});

test('location missing one of line/column is rejected', () => {
  assert.equal(parseStackFrame('    at foo (/a.js:10)'), null);
  assert.equal(parseStackFrame('    at foo (/a.js::20)'), null);
});

test('non-numeric line/column rejected', () => {
  assert.equal(parseStackFrame('    at foo (/a.js:abc:20)'), null);
  assert.equal(parseStackFrame('    at foo (/a.js:10:xyz)'), null);
});

test('unbalanced parens rejected', () => {
  assert.equal(parseStackFrame('    at foo (/a.js:1:2'), null);
  assert.equal(parseStackFrame('    at foo /a.js:1:2)'), null);
});

test('whitespace-only body returns null', () => {
  assert.equal(parseStackFrame('    at   '), null);
});
