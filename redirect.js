const DEFAULT_URL = "";

function openUrl(url, keepAddressBarFocus) {
  if (keepAddressBarFocus && chrome.tabs?.getCurrent) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id === undefined) {
        location.replace(url);
        return;
      }
      chrome.tabs.update(tab.id, { url });
    });
    return;
  }

  location.replace(url);
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

function openSettings() {
  location.replace(chrome.runtime.getURL("options.html"));
}

if (!chrome?.storage?.local) {
  openSettings();
} else {
  chrome.storage.local.get({ targetUrl: DEFAULT_URL, focusAddressBar: false }, (items) => {
    const url = normalizeUrl(items.targetUrl);
    if (!url) {
      openSettings();
      return;
    }

    openUrl(url, items.focusAddressBar === true);
  });
}
