/* Dolphin ERP v14.6 API shim
 * Cloudflare Pages 전용.
 * 중요: 브라우저는 Apps Script를 직접 호출하지 않습니다.
 * 검증된 /api?action=... GET 경로만 사용합니다.
 */
(function () {
  'use strict';

  var pendingRequests = {};

  function buildApiUrl(action, args) {
    var url = new URL('/api', window.location.origin);
    url.searchParams.set('action', String(action || ''));
    url.searchParams.set('payload', JSON.stringify(args || []));
    url.searchParams.set('_', String(Date.now()));
    return url.toString();
  }

  function callApi(action, args, onSuccess, onFailure) {
    fetch(buildApiUrl(action, args), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'Cache-Control': 'no-cache'
      }
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error('Cloudflare /api 응답이 JSON이 아닙니다. 응답 일부: ' + text.slice(0, 300));
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
      })
      .finally(function () {
        // no-op: 중복요청 관리는 화면별 beginAction에서 처리합니다.
      });
  }

  function createRunner() {
    var state = { success: null, failure: null };
    var runner = new Proxy({}, {
      get: function (target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (fn) { state.success = fn; return runner; };
        }
        if (prop === 'withFailureHandler') {
          return function (fn) { state.failure = fn; return runner; };
        }
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var success = state.success;
          var failure = state.failure;
          state = { success: null, failure: null };
          callApi(String(prop), args, success, failure);
          return runner;
        };
      }
    });
    return runner;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner();

  window.DOLPHIN_API_MODE = 'cloudflare-get-proxy-v13.2';
})();
