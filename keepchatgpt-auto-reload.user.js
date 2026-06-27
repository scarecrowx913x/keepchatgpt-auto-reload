// ==UserScript==
// @name         KeepChatGPT Auto Reload on Chat Switch
// @namespace    https://github.com/scarecrowx913x/keepchatgpt-auto-reload
// @version      0.8
// @description  ChatGPTでトーク切替後にKeepChatGPTが消える場合、自動で1回だけ再読み込みする
// @homepageURL  https://github.com/scarecrowx913x/keepchatgpt-auto-reload
// @supportURL   https://github.com/scarecrowx913x/keepchatgpt-auto-reload/issues
// @updateURL    https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js
// @downloadURL  https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js
// @license      MIT
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const RELOAD_KEY_PREFIX = 'kcg_auto_reload_done:';
  const CHECK_INTERVAL_MS = 500;
  const CHECK_TIMEOUT_MS = 7000;
  const USER_IDLE_RELOAD_DELAY_MS = 30000;
  const URL_CHANGE_EVENT = 'kcg-auto-reload:url-change';
  const HOOKED_KEY = '__kcgAutoReloadHooked';

  let lastUrl = location.href;
  let checkTimer = null;
  let mutationTimer = null;
  let reloadDeferTimer = null;
  let lastUserEditAt = 0;
  let isComposing = false;

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

  function clearReloadDeferTimer() {
    if (reloadDeferTimer) {
      clearTimeout(reloadDeferTimer);
      reloadDeferTimer = null;
    }
  }

  function closestEditableElement(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    return element.closest(
      [
        'textarea',
        'input',
        '[contenteditable]',
        '[role="textbox"]'
      ].join(',')
    );
  }

  function isTextInputElement(element) {
    if (!(element instanceof HTMLInputElement)) {
      return false;
    }

    const type = (element.getAttribute('type') || 'text').toLowerCase();

    return [
      'email',
      'number',
      'password',
      'search',
      'tel',
      'text',
      'url'
    ].includes(type);
  }

  function isEditableElement(element) {
    if (!element) {
      return false;
    }

    return (
      element instanceof HTMLTextAreaElement ||
      isTextInputElement(element) ||
      element.isContentEditable ||
      element.getAttribute?.('role') === 'textbox'
    );
  }

  function editableText(element) {
    if (element instanceof HTMLTextAreaElement || isTextInputElement(element)) {
      return element.value;
    }

    return element?.textContent || '';
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.getClientRects().length > 0
    );
  }

  function hasDraftText() {
    const activeEditable = closestEditableElement(document.activeElement);

    if (isEditableElement(activeEditable) && editableText(activeEditable).trim()) {
      return true;
    }

    return Array.from(
      document.querySelectorAll(
        [
          'textarea',
          'input[type="text"]',
          'input[type="search"]',
          '[contenteditable]',
          '[role="textbox"]'
        ].join(',')
      )
    ).some(
      element =>
        isVisibleElement(element) &&
        isEditableElement(element) &&
        editableText(element).trim()
    );
  }

  function isUserEditing() {
    return Boolean(closestEditableElement(document.activeElement));
  }

  function recordUserEdit(event) {
    if (closestEditableElement(event.target)) {
      lastUserEditAt = Date.now();
    }
  }

  function shouldProtectUserInput() {
    if (isComposing) {
      return 'ime composition active';
    }

    if (hasDraftText()) {
      return 'draft text exists';
    }

    if (isUserEditing() && Date.now() - lastUserEditAt < USER_IDLE_RELOAD_DELAY_MS) {
      return 'recent edit activity';
    }

    return '';
  }

  function safeReload(reason, key) {
    const protectReason = shouldProtectUserInput();

    if (!protectReason) {
      clearReloadDeferTimer();
      markReloaded(key);
      log('KeepChatGPT UI missing after wait. reload now.', reason);
      location.reload();
      return;
    }

    log('Skip reload while user input is protected.', protectReason, reason);

    clearReloadDeferTimer();
    reloadDeferTimer = setTimeout(() => {
      reloadDeferTimer = null;
      scheduleCheck('deferred after user input');
    }, USER_IDLE_RELOAD_DELAY_MS);
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
        clearReloadDeferTimer();
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

      checkTimer = null;
      safeReload(reason, key);
    }

    checkTimer = setTimeout(checkLoop, CHECK_INTERVAL_MS);
  }

  function checkUrlChange(reason) {
    const currentUrl = location.href;

    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;
    clearReloadDeferTimer();
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

  document.addEventListener('input', recordUserEdit, true);
  document.addEventListener('keydown', recordUserEdit, true);
  document.addEventListener('paste', recordUserEdit, true);
  document.addEventListener('focusin', recordUserEdit, true);
  document.addEventListener(
    'compositionstart',
    event => {
      if (closestEditableElement(event.target)) {
        isComposing = true;
        recordUserEdit(event);
      }
    },
    true
  );
  document.addEventListener(
    'compositionend',
    event => {
      if (closestEditableElement(event.target)) {
        isComposing = false;
        recordUserEdit(event);
      }
    },
    true
  );

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
