/* Dolphin ERP v12 API shim
 * 기존 Apps Script 화면 코드의 google.script.run 호출을 Cloudflare에서도 동작하게 만드는 어댑터입니다.
 * config.js의 CONFIG.API_URL에 Apps Script 웹앱 URL을 넣어야 합니다.
 */
(function () {
  'use strict';

  function getApiUrl() {
    var cfg = window.CONFIG || {};
    var url = String(cfg.API_URL || '').trim();
    if (!url || url.indexOf('PASTE_APPS_SCRIPT_WEBAPP_URL_HERE') >= 0) {
      throw new Error('config.js의 CONFIG.API_URL에 Apps Script 웹앱 URL을 입력하세요.');
    }
    return url;
  }

  function jsonp(action, args, onSuccess, onFailure) {
    var callbackName = '__dolphinApiCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    var script = document.createElement('script');
    var url;

    window[callbackName] = function (response) {
      cleanup();
      if (response && response.ok) {
        if (typeof onSuccess === 'function') onSuccess(response.result);
      } else {
        var message = response && response.error ? response.error : 'API 호출 실패';
        if (typeof onFailure === 'function') onFailure({ message: message });
        else alert(message);
      }
    };

    function cleanup() {
      try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    }

    var timer = setTimeout(function () {
      cleanup();
      var err = { message: 'API 응답 시간이 초과되었습니다.' };
      if (typeof onFailure === 'function') onFailure(err);
      else alert(err.message);
    }, 30000);

    try {
      url = getApiUrl();
      var qs = [
        'action=' + encodeURIComponent(action),
        'payload=' + encodeURIComponent(JSON.stringify(args || [])),
        'callback=' + encodeURIComponent(callbackName),
        '_=' + Date.now()
      ].join('&');
      script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + qs;
      script.onerror = function () {
        cleanup();
        var err = { message: 'API 스크립트 로드 실패. Apps Script 배포 URL/권한을 확인하세요.' };
        if (typeof onFailure === 'function') onFailure(err);
        else alert(err.message);
      };
      document.head.appendChild(script);
    } catch (e) {
      cleanup();
      if (typeof onFailure === 'function') onFailure(e);
      else alert(e.message || e);
    }
  }

  function createRunner() {
    var state = { success: null, failure: null };
    var runner = {};

    return new Proxy(runner, {
      get: function (target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (fn) { state.success = fn; return this; };
        }
        if (prop === 'withFailureHandler') {
          return function (fn) { state.failure = fn; return this; };
        }
        return function () {
          var args = Array.prototype.slice.call(arguments);
          jsonp(String(prop), args, state.success, state.failure);
          state = { success: null, failure: null };
          return this;
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner();
})();
