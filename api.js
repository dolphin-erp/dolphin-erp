/* Dolphin ERP v13 API shim
 * 브라우저는 Apps Script를 직접 호출하지 않습니다.
 * Cloudflare Pages Function(/api)이 Apps Script를 대신 호출합니다.
 */
(function () {
  'use strict';

  function callApi(action, args, onSuccess, onFailure) {
    fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, args: args || [] }),
      cache: 'no-store'
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error('API 응답이 JSON이 아닙니다. 응답 일부: ' + text.slice(0, 300));
          }
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || data.message || 'API 호출 실패');
          }
          return data.result;
        });
      })
      .then(function (result) {
        if (typeof onSuccess === 'function') onSuccess(result);
      })
      .catch(function (err) {
        if (typeof onFailure === 'function') onFailure(err);
        else alert(err.message || String(err));
      });
  }

  function createRunner() {
    var state = { success: null, failure: null };
    return new Proxy({}, {
      get: function (target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (fn) { state.success = fn; return this; };
        }
        if (prop === 'withFailureHandler') {
          return function (fn) { state.failure = fn; return this; };
        }
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var success = state.success;
          var failure = state.failure;
          state = { success: null, failure: null };
          callApi(String(prop), args, success, failure);
          return this;
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner();
})();
