// ==UserScript==
// @name         KeepChatGPT Auto Reload on Chat Switch
// @namespace    https://github.com/scarecrowx913x/keepchatgpt-auto-reload
// @version      0.7
// @description  ChatGPTでトーク切替後にKeepChatGPTが消える場合、自動で1回だけ再読み込みする
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const RELOAD_KEY_PREFIX = 'kcg_auto_reload_done:';
  const CHECK_INTERVAL_MS = 500;
  const CHECK_TIMEOUT_MS = 7000;
  const URL_CHANGE_EVENT = 'kcg-auto-reload:url-change';
  const HOOKED_KEY = '__kcgAutoReloadHooked';

  let lastUrl = location.href;
  let checkTimer = null;
  let mutationTimer = null;

  function log(...args) {
    console.log('[KCG Auto Reload]', ...args);
  }

  function isChatPage() {
    const path = location.pathname;

    return (
      path.startsWith('/c/') ||
      path.startsWith('/g/') ||
      path.startsWith('/project/') ||
      path.startsWith('/projects/')
    );
  }

  function hasKeepChatGPTUi() {
    if (window.__KeepChatGPTReady === true) {
      return true;
    }

    if (document.documentElement.dataset.keepchatgptReady === '1') {
      return true;
    }

    return Boolean(
      document.querySelector(
        [
          '[data-keepchatgpt-ready="1"]',
          '[id*="KeepChatGPT" i]',
          '[class*="KeepChatGPT" i]',
          '[title*="KeepChatGPT" i]',
          '[aria-label*="KeepChatGPT" i]',
          '[data-testid*="KeepChatGPT" i]',
          '[data-name*="KeepChatGPT" i]',
          '[data-tooltip*="KeepChatGPT" i]'
        ].join(',')
      )
    );
  }

  function currentKey() {
    return RELOAD_KEY_PREFIX + location.pathname;
  }

  function hasReloaded(key) {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  function markReloaded(key) {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
  }

  function clearCheckTimer() {
    if (checkTimer) {
      clearTimeout(checkTimer);
      checkTimer = null;
    }
  }

  function scheduleCheck(reason) {
    clearCheckTimer();

    if (!isChatPage()) {
      return;
    }

    const startedAt = Date.now();

    function checkLoop() {
      if (!isChatPage()) {
        checkTimer = null;
        return;
      }

      if (hasKeepChatGPTUi()) {
        checkTimer = null;
        log('KeepChatGPT UI found. no reload.', reason);
        return;
      }

      const elapsed = Date.now() - startedAt;

      if (elapsed < CHECK_TIMEOUT_MS) {
        checkTimer = setTimeout(checkLoop, CHECK_INTERVAL_MS);
        return;
      }

      const key = currentKey();

      if (hasReloaded(key)) {
        checkTimer = null;
        log('Already reloaded once for this page. skip.', reason);
        return;
      }

      markReloaded(key);
      checkTimer = null;
      log('KeepChatGPT UI missing after wait. reload now.', reason);
      location.reload();
    }

    checkTimer = setTimeout(checkLoop, CHECK_INTERVAL_MS);
  }

  function checkUrlChange(reason) {
    const currentUrl = location.href;

    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;
    log('URL changed:', reason, currentUrl);
    scheduleCheck(reason);
  }

  function emitUrlChange(reason) {
    window.dispatchEvent(
      new CustomEvent(URL_CHANGE_EVENT, {
        detail: { reason }
      })
    );
  }

  function hookHistory() {
    if (history[HOOKED_KEY]) {
      return;
    }

    Object.defineProperty(history, HOOKED_KEY, {
      value: true,
      configurable: true
    });

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      emitUrlChange('pushState');
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      emitUrlChange('replaceState');
      return result;
    };

    window.addEventListener('popstate', () => {
      emitUrlChange('popstate');
    });
  }

  window.addEventListener(URL_CHANGE_EVENT, event => {
    setTimeout(() => {
      checkUrlChange(event.detail?.reason || 'unknown');
    }, 100);
  });

  hookHistory();

  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);

    mutationTimer = setTimeout(() => {
      checkUrlChange('mutation');
    }, 100);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
