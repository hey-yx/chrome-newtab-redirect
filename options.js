const DEFAULT_URL = "";
const DEFAULT_LANG = "en";
const LANGUAGES = ["en", "zh"];

const MESSAGES = {
  en: {
    documentTitle: "New tab settings",
    languageLabel: "Language",
    title: "New tab settings",
    lede: "Choose the page that opens in every new tab. The first frame follows your system theme.",
    urlLabel: "Page URL",
    urlHint: "Only http:// and https:// addresses. If you leave out the protocol, https:// is added.",
    focusLabel: "Keep the address bar focused in new tabs",
    focusHint: "Type a URL or search without clicking the address bar. Save to apply.",
    save: "Save",
    clear: "Clear",
    saved: "Saved. Your changes apply to the next new tab.",
    cleared: "Cleared. New tabs will open this settings page until you add an address.",
    invalid: "That address is not valid. Use an http:// or https:// URL.",
    currentLabel: "Current",
    notConfigured: "Not configured",
    emptyNote: "If no address is set, every new tab opens this settings page.",
    themeNote: "This extension only controls the new tab's first frame and redirect. It does not change the colors of other websites.",
    themeLight: "System theme: light · first frame white",
    themeDark: "System theme: dark · first frame black"
  },
  zh: {
    documentTitle: "新标签页设置",
    languageLabel: "语言",
    title: "新标签页设置",
    lede: "设置每次打开新标签页时要进入的页面。首帧颜色跟随系统主题。",
    urlLabel: "页面地址",
    urlHint: "只支持 http:// 或 https:// 地址；不写协议时会自动补上 https://。",
    focusLabel: "打开新标签页后保留地址栏焦点",
    focusHint: "无需点击地址栏，就能输入网址或搜索。默认关闭，点击保存后生效。",
    save: "保存",
    clear: "清空",
    saved: "已保存，下次打开新标签页生效。",
    cleared: "已清空。在填写地址之前，新标签页会打开这个设置页。",
    invalid: "地址格式不对，请填写 http:// 或 https:// 地址。",
    currentLabel: "当前",
    notConfigured: "未配置",
    emptyNote: "未设置地址时，每次打开新标签页都会进入这个设置页。",
    themeNote: "这个扩展只负责新标签页的首帧颜色和跳转，不会修改其他网站的配色。",
    themeLight: "系统主题：亮色 · 首帧白色",
    themeDark: "系统主题：暗色 · 首帧黑色"
  }
};

const elements = {
  form: document.getElementById("settings-form"),
  input: document.getElementById("target-url"),
  help: document.getElementById("url-help"),
  focusAddressBar: document.getElementById("focus-address-bar"),
  status: document.getElementById("status"),
  current: document.getElementById("current-value"),
  scheme: document.getElementById("scheme-status"),
  langGroup: document.querySelector(".lang-switch"),
  langButtons: Array.from(document.querySelectorAll(".lang-button")),
  clear: document.getElementById("clear-button")
};

const state = {
  language: DEFAULT_LANG,
  currentUrl: "",
  fieldError: false,
  statusKey: "",
  statusKind: "success",
  isDark: window.matchMedia("(prefers-color-scheme: dark)").matches
};

function t(key) {
  return MESSAGES[state.language]?.[key] ?? MESSAGES.en[key] ?? key;
}

function hasStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function normalizeUrl(raw) {
  let value = String(raw || "").trim();
  if (!value) {
    return null;
  }

  const scheme = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (scheme && !/^https?$/i.test(scheme[1])) {
    const rest = value.slice(scheme[0].length);
    if (!/^\d+(?:[/?#]|$)/.test(rest)) {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function renderText() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("documentTitle");

  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }

  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }

  for (const button of elements.langButtons) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.lang === state.language ? "true" : "false"
    );
  }
}

function renderHelp() {
  elements.help.textContent = state.fieldError ? t("invalid") : t("urlHint");
  elements.help.dataset.state = state.fieldError ? "error" : "hint";
  elements.input.setAttribute("aria-invalid", state.fieldError ? "true" : "false");
}

function renderCurrent() {
  elements.current.textContent = state.currentUrl || t("notConfigured");
  elements.current.classList.toggle("is-empty", !state.currentUrl);
}

function renderStatus() {
  elements.status.textContent = state.statusKey ? t(state.statusKey) : "";
  elements.status.className = state.statusKey
    ? "status is-" + state.statusKind
    : "status";
}

function renderScheme() {
  elements.scheme.textContent = state.isDark ? t("themeDark") : t("themeLight");
}

function renderAll() {
  renderText();
  renderHelp();
  renderCurrent();
  renderStatus();
  renderScheme();
}

function setLanguage(language, persist) {
  state.language = LANGUAGES.includes(language) ? language : DEFAULT_LANG;
  renderAll();

  if (persist && hasStorage()) {
    chrome.storage.local.set({ uiLanguage: state.language });
  }
}

function saveTarget(url) {
  state.currentUrl = url;
  state.fieldError = false;
  state.statusKey = url ? "saved" : "cleared";
  state.statusKind = "success";
  renderHelp();
  renderCurrent();
  renderStatus();

  if (hasStorage()) {
    chrome.storage.local.set({ targetUrl: url, focusAddressBar: elements.focusAddressBar.checked });
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const raw = elements.input.value.trim();

  if (!raw) {
    elements.input.value = "";
    saveTarget("");
    return;
  }

  const url = normalizeUrl(raw);
  if (!url) {
    state.fieldError = true;
    state.statusKey = "";
    renderHelp();
    renderStatus();
    elements.input.focus();
    return;
  }

  elements.input.value = url;
  saveTarget(url);
}

function handleClear() {
  elements.input.value = "";
  saveTarget("");
  elements.input.focus();
}

function handleInput() {
  if (state.fieldError) {
    state.fieldError = false;
    renderHelp();
  }

  if (state.statusKey) {
    state.statusKey = "";
    renderStatus();
  }
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.clear.addEventListener("click", handleClear);
  elements.input.addEventListener("input", handleInput);
  elements.focusAddressBar.addEventListener("change", () => {
    state.statusKey = "";
    renderStatus();
  });

  for (const button of elements.langButtons) {
    button.addEventListener("click", () => {
      const language = button.dataset.lang;
      if (language && language !== state.language) {
        setLanguage(language, true);
      }
    });
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (event) => {
    state.isDark = event.matches;
    renderScheme();
  });
}

function load() {
  bindEvents();

  if (!hasStorage()) {
    renderAll();
    return;
  }

  chrome.storage.local.get(
    { targetUrl: DEFAULT_URL, uiLanguage: DEFAULT_LANG, focusAddressBar: false },
    (items) => {
      state.language = items.uiLanguage === "zh" ? "zh" : DEFAULT_LANG;
      state.currentUrl = normalizeUrl(items.targetUrl) || "";
      elements.input.value = state.currentUrl;
      elements.focusAddressBar.checked = items.focusAddressBar === true;
      renderAll();
    }
  );
}

load();
