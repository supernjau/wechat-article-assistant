(function () {
  "use strict";

  const status = document.querySelector("#status");

  document.querySelector("#open-panel").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/mp\.weixin\.qq\.com\//.test(tab.url || "")) {
      status.textContent = "请先打开微信公众号文章编辑页。";
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "SEWA_OPEN_PANEL" });
      window.close();
    } catch {
      status.textContent = "当前页面尚未加载文章助手，请刷新页面后重试。";
    }
  });

  document.querySelector("#open-mp").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://mp.weixin.qq.com/" });
  });
})();
