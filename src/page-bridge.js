(function (root) {
  "use strict";

  const REQUEST_TYPE = "SEWA_MP_EDITOR_REQUEST";
  const RESPONSE_TYPE = "SEWA_MP_EDITOR_RESPONSE";

  if (root.__SEWA_MP_EDITOR_BRIDGE__) return;
  root.__SEWA_MP_EDITOR_BRIDGE__ = true;

  function serializable(value) {
    if (value === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  function respond(id, ok, payload) {
    root.postMessage(
      {
        source: "SEWA_PAGE_BRIDGE",
        type: RESPONSE_TYPE,
        id,
        ok,
        ...payload,
      },
      "*",
    );
  }

  root.addEventListener("message", (event) => {
    const message = event.data;
    if (
      event.source !== root ||
      !message ||
      message.source !== "SEWA_CONTENT_SCRIPT" ||
      message.type !== REQUEST_TYPE ||
      !message.id
    ) {
      return;
    }

    const api = root.__MP_Editor_JSAPI__;
    if (!api || typeof api.invoke !== "function") {
      respond(message.id, false, {
        error: "公众号编辑器接口尚未准备好，请刷新文章编辑页后重试。",
      });
      return;
    }

    try {
      api.invoke({
        apiName: message.apiName,
        apiParam: message.apiParam || {},
        sucCb(result) {
          respond(message.id, true, { result: serializable(result) });
        },
        errCb(error) {
          respond(message.id, false, {
            error:
              (error && (error.errMsg || error.message)) ||
              "公众号编辑器未接受本次写入。",
          });
        },
      });
    } catch (error) {
      respond(message.id, false, {
        error: error.message || String(error),
      });
    }
  });
})(window);
