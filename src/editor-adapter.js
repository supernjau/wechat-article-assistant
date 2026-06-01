(function (root) {
  "use strict";

  const BLOCKED_TAGS = "script,style,link,meta,iframe,object,embed,form";
  const EDITOR_SELECTORS = [
    "#ueditor_0",
    ".ProseMirror",
    "[contenteditable='true']",
  ];
  const URL_ATTRIBUTES = new Set(["href", "src", "data-src", "xlink:href"]);
  const REQUEST_TYPE = "SEWA_MP_EDITOR_REQUEST";
  const RESPONSE_TYPE = "SEWA_MP_EDITOR_RESPONSE";
  const REQUEST_TIMEOUT = 5000;

  let rememberedEditor = null;
  let rememberedRange = null;
  let pageBridgePromise = null;
  let requestSequence = 0;
  const pendingRequests = new Map();

  function isOfficialEditorPage() {
    return Boolean(
      root.location &&
        root.location.hostname === "mp.weixin.qq.com" &&
        /\/cgi-bin\/appmsg/.test(root.location.pathname),
    );
  }

  function injectPageBridge() {
    if (!isOfficialEditorPage()) return Promise.resolve(false);
    if (pageBridgePromise) return pageBridgePromise;
    if (
      !root.chrome ||
      !root.chrome.runtime ||
      typeof root.chrome.runtime.getURL !== "function"
    ) {
      throw new Error("无法加载公众号编辑器桥接脚本，请重新加载扩展后再试。");
    }
    pageBridgePromise = new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.id = "sewa-mp-editor-bridge";
      script.src = root.chrome.runtime.getURL("src/page-bridge.js");
      script.addEventListener("load", () => {
        script.remove();
        resolve(true);
      });
      script.addEventListener("error", () => {
        script.remove();
        pageBridgePromise = null;
        reject(new Error("公众号编辑器桥接脚本加载失败，请重新加载扩展。"));
      });
      (root.document.head || root.document.documentElement).append(script);
    });
    return pageBridgePromise;
  }

  async function requestOfficialEditor(apiName, apiParam) {
    await injectPageBridge();
    const id = `sewa-${Date.now()}-${requestSequence += 1}`;

    return new Promise((resolve, reject) => {
      const timeout = root.setTimeout(() => {
        pendingRequests.delete(id);
        reject(
          new Error("公众号编辑器响应超时，请刷新文章编辑页后重新导入。"),
        );
      }, REQUEST_TIMEOUT);

      pendingRequests.set(id, { resolve, reject, timeout });
      root.postMessage(
        {
          source: "SEWA_CONTENT_SCRIPT",
          type: REQUEST_TYPE,
          id,
          apiName,
          apiParam: apiParam || {},
        },
        "*",
      );
    });
  }

  root.addEventListener("message", (event) => {
    const message = event.data;
    if (
      event.source !== root ||
      !message ||
      message.source !== "SEWA_PAGE_BRIDGE" ||
      message.type !== RESPONSE_TYPE ||
      !pendingRequests.has(message.id)
    ) {
      return;
    }

    const pending = pendingRequests.get(message.id);
    pendingRequests.delete(message.id);
    root.clearTimeout(pending.timeout);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || "公众号编辑器写入失败。"));
    }
  });

  function isInsideSewaUi(element) {
    return Boolean(
      element.closest('[class^="sewa-"], [class*=" sewa-"]'),
    );
  }

  function isVisible(element) {
    if (!element || element.nodeType !== 1 || !element.isConnected) return false;
    if (element.hidden || isInsideSewaUi(element)) return false;

    const view = element.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse"
      ) {
        return false;
      }

      try {
        const frame = view.frameElement;
        if (frame && !isVisible(frame)) return false;
      } catch {
        return false;
      }
    }

    return (
      element.getClientRects().length > 0 ||
      element.offsetWidth > 0 ||
      element.offsetHeight > 0
    );
  }

  function editorPriority(element) {
    if (element.id === "ueditor_0") return 0;
    if (
      element.hasAttribute("contenteditable") &&
      element.getAttribute("contenteditable").toLowerCase() !== "false"
    ) {
      return 1;
    }
    return element.classList.contains("ProseMirror") ? 2 : 3;
  }

  function findEditorInDocument(doc) {
    if (!doc || !doc.querySelectorAll) return null;

    return (
      Array.from(doc.querySelectorAll(EDITOR_SELECTORS.join(",")))
        .filter((element) => element.tagName !== "IFRAME" && isVisible(element))
        .sort((left, right) => editorPriority(left) - editorPriority(right))[0] ||
      null
    );
  }

  function getIframeDocument(frame) {
    try {
      return frame.contentDocument || frame.contentWindow.document || null;
    } catch {
      return null;
    }
  }

  function findEditor() {
    const documents = [root.document];
    const visited = new Set();

    while (documents.length) {
      const doc = documents.shift();
      if (!doc || visited.has(doc)) continue;
      visited.add(doc);

      const editor = findEditorInDocument(doc);
      if (editor) return editor;

      for (const frame of doc.querySelectorAll("iframe")) {
        if (!isVisible(frame)) continue;
        const frameDocument = getIframeDocument(frame);
        if (frameDocument && !visited.has(frameDocument)) {
          documents.push(frameDocument);
        }
      }
    }

    return null;
  }

  function requireEditor() {
    const editor = findEditor();
    if (!editor) {
      throw new Error(
        "未找到公众号正文编辑器，请确认当前页面是微信公众号文章编辑页。",
      );
    }
    return editor;
  }

  function containsRange(editor, range) {
    return (
      range &&
      editor.ownerDocument === range.startContainer.ownerDocument &&
      editor.contains(range.startContainer) &&
      editor.contains(range.endContainer)
    );
  }

  function storeSelection(editor) {
    const selection = editor.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    if (!containsRange(editor, range)) return false;

    rememberedEditor = editor;
    rememberedRange = range.cloneRange();
    return true;
  }

  function rememberSelection() {
    const editor = findEditor();
    return editor ? storeSelection(editor) : false;
  }

  function sanitizeHtml(html) {
    const safeUrl = root.SEWA && root.SEWA.Core && root.SEWA.Core.safeUrl;
    if (typeof safeUrl !== "function") {
      throw new Error("SEWA.Core.safeUrl 不可用，请先加载 src/core.js。");
    }

    const doc = new root.DOMParser().parseFromString(
      String(html || ""),
      "text/html",
    );

    for (const element of doc.querySelectorAll(BLOCKED_TAGS)) {
      element.remove();
    }

    for (const element of doc.body.querySelectorAll("*")) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (!URL_ATTRIBUTES.has(name)) continue;

        const value = safeUrl(attribute.value);
        if (attribute.value && !value) {
          element.removeAttribute(attribute.name);
        } else if (value !== attribute.value) {
          element.setAttribute(attribute.name, value);
        }
      }
    }

    return doc.body.innerHTML;
  }

  function dispatchWriteEvents(editor) {
    const EventConstructor =
      (editor.ownerDocument.defaultView &&
        editor.ownerDocument.defaultView.Event) ||
      root.Event;
    editor.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    editor.dispatchEvent(new EventConstructor("change", { bubbles: true }));
  }

  async function replaceHtml(html) {
    const sanitized = sanitizeHtml(html);
    if (!sanitized.trim()) return false;
    if (isOfficialEditorPage()) {
      await requestOfficialEditor("mp_editor_set_content", {
        content: sanitized,
      });
      return true;
    }

    const editor = requireEditor();
    const snapshot = editor.innerHTML;
    try {
      editor.innerHTML = sanitized;
      dispatchWriteEvents(editor);
    } catch (error) {
      try {
        editor.innerHTML = snapshot;
        dispatchWriteEvents(editor);
      } catch (restoreError) {
        error.restoreError = restoreError;
      }
      throw error;
    }

    return true;
  }

  function restoreRememberedRange(editor) {
    if (
      rememberedEditor !== editor ||
      !containsRange(editor, rememberedRange)
    ) {
      throw new Error(
        "无法恢复正文光标位置，请先点击正文中的插入位置后再试。",
      );
    }

    const selection = editor.ownerDocument.getSelection();
    const range = rememberedRange.cloneRange();
    if (!selection) {
      throw new Error(
        "无法读取正文光标位置，请先点击正文中的插入位置后再试。",
      );
    }

    if (typeof editor.focus === "function") editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    return { range, selection };
  }

  async function insertHtml(html) {
    const sanitized = sanitizeHtml(html);
    if (!sanitized.trim()) return false;
    if (isOfficialEditorPage()) {
      await requestOfficialEditor("mp_editor_insert_html", {
        html: sanitized,
        isSelect: false,
      });
      return true;
    }

    const editor = requireEditor();
    const { range, selection } = restoreRememberedRange(editor);
    let inserted = false;

    if (typeof editor.ownerDocument.execCommand === "function") {
      try {
        inserted = editor.ownerDocument.execCommand(
          "insertHTML",
          false,
          sanitized,
        );
      } catch {
        inserted = false;
      }
    }

    if (!inserted) {
      range.deleteContents();
      const fragment = range.createContextualFragment(sanitized);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    dispatchWriteEvents(editor);
    storeSelection(editor);
    return true;
  }

  async function appendHtml(html) {
    const sanitized = sanitizeHtml(html);
    if (!sanitized.trim()) return false;
    if (isOfficialEditorPage()) {
      const current = await getHtml();
      await requestOfficialEditor("mp_editor_set_content", {
        content: `${current}${sanitized}`,
      });
      return true;
    }

    const editor = requireEditor();
    const range = editor.ownerDocument.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    editor.appendChild(range.createContextualFragment(sanitized));
    dispatchWriteEvents(editor);
    return true;
  }

  async function getHtml() {
    if (isOfficialEditorPage()) {
      const result = await requestOfficialEditor("mp_editor_get_content");
      if (typeof result === "string") return result;
      if (result && typeof result.content === "string") return result.content;
      if (
        result &&
        result.data &&
        typeof result.data.content === "string"
      ) {
        return result.data.content;
      }
      if (result && typeof result.html === "string") return result.html;
      throw new Error("公众号编辑器返回了无法识别的正文格式。");
    }
    return requireEditor().innerHTML;
  }

  root.SEWA = root.SEWA || {};
  root.SEWA.EditorAdapter = {
    findEditor,
    rememberSelection,
    sanitizeHtml,
    replaceHtml,
    insertHtml,
    appendHtml,
    getHtml,
  };
})(window);
