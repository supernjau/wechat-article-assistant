const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/page-bridge.js"),
  "utf8",
);

test("page bridge invokes the official editor API and returns its result", () => {
  const listeners = {};
  const messages = [];
  const calls = [];
  const window = {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    postMessage(message) {
      messages.push(message);
    },
    __MP_Editor_JSAPI__: {
      invoke(options) {
        calls.push(options);
        options.sucCb({ content: "<p>正文</p>" });
      },
    },
  };

  vm.runInNewContext(source, { window });
  listeners.message({
    source: window,
    data: {
      source: "SEWA_CONTENT_SCRIPT",
      type: "SEWA_MP_EDITOR_REQUEST",
      id: "request-1",
      apiName: "mp_editor_set_content",
      apiParam: { content: "<p>正文</p>" },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].apiName, "mp_editor_set_content");
  assert.equal(calls[0].apiParam.content, "<p>正文</p>");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "SEWA_MP_EDITOR_RESPONSE");
  assert.equal(messages[0].id, "request-1");
  assert.equal(messages[0].ok, true);
  assert.equal(messages[0].result.content, "<p>正文</p>");
});

test("page bridge reports when the official editor API is unavailable", () => {
  const listeners = {};
  const messages = [];
  const window = {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    postMessage(message) {
      messages.push(message);
    },
  };

  vm.runInNewContext(source, { window });
  listeners.message({
    source: window,
    data: {
      source: "SEWA_CONTENT_SCRIPT",
      type: "SEWA_MP_EDITOR_REQUEST",
      id: "request-2",
      apiName: "mp_editor_get_content",
    },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].ok, false);
  assert.match(messages[0].error, /接口尚未准备好/);
});
