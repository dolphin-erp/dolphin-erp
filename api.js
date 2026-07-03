/* Dolphin ERP v12.1 API shim
 * 모바일 브라우저에서 Apps Script JSONP 로드가 막히는 문제를 피하기 위해
 * Cloudflare Pages Function(/api)을 통해 Apps Script를 호출합니다.
 */
(function () {
  'use strict';

  function getApiUrl() {
    var cfg = window.CONFIG || {};
    var url = String(cfg.API_URL || '/api').trim();
    return url || '/api';
  }

  function callApi(action, args, onSuccess, onFailure) {
    var url = getApiUrl();

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, payload: args || [] }),
      cache: 'no-store'
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            throw new Error('API 응답 해석 실패: ' + text.slice(0, 120));
          }
          if (!res.ok) {
            throw new Error((data && data.error) || ('HTTP ' + res.status));
          }
          return data;
        });
      })
      .then(function (response) {
        if (response && response.ok) {
          if (typeof onSuccess === 'function') onSuccess(response.result);
        } else {
          throw new Error(response && response.error ? response.error : 'API 호출 실패');
        }
      })
      .catch(function (err) {
        var errorObj = { message: err && err.message ? err.message : String(err) };
        if (typeof onFailure === 'function') onFailure(errorObj);
        else alert(errorObj.message);
      });
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
          callApi(String(prop), args, state.success, state.failure);
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
