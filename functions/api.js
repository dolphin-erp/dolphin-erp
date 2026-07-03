// Dolphin ERP v13 Cloudflare Pages Function - backend Code.gs API와 세트
// 핵심: Apps Script를 JSONP callback 방식으로 호출한 뒤 Cloudflare가 JSON으로 변환합니다.
// 이유: 현재 Apps Script는 직접 JSON보다 callback 응답이 가장 안정적입니다.

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhys504lPWXdQsqgkbjEezu_w3XRcrQpyLvoQSy9FMy9Zm0zPtXIzvEvyCd-tM58-0/exec';

export async function onRequest(context) {
  const request = context.request;

  if (request.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const input = await readInput(request);
    const action = String(input.action || '').trim();
    const args = Array.isArray(input.args) ? input.args : [];

    if (!action) {
      return json({ ok: false, error: 'action이 없습니다.' }, 400);
    }

    const appsScriptUrl = getAppsScriptUrl(context.env);
    const callbackName = '__dolphin_cf_callback__';
    const target = new URL(appsScriptUrl);
    target.searchParams.set('action', action);
    target.searchParams.set('payload', JSON.stringify(args));
    target.searchParams.set('callback', callbackName);
    target.searchParams.set('_', String(Date.now()));

    const res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'application/javascript,text/javascript,text/plain,*/*',
        'Cache-Control': 'no-cache',
        'User-Agent': 'DolphinERP-Cloudflare-Proxy/13.0'
      }
    });

    const text = await res.text();
    const parsed = parseAppsScriptResponse(text, callbackName);

    return json(parsed, parsed && parsed.ok === false ? 502 : 200);
  } catch (err) {
    return json({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, 500);
  }
}

async function readInput(request) {
  if (request.method === 'POST') {
    return await request.json().catch(() => ({}));
  }
  const u = new URL(request.url);
  const action = u.searchParams.get('action') || '';
  let args = [];
  const payload = u.searchParams.get('payload');
  if (payload) {
    const parsed = JSON.parse(payload);
    args = Array.isArray(parsed) ? parsed : [parsed];
  }
  return { action, args };
}

function getAppsScriptUrl(env) {
  // 나중에 Cloudflare 환경변수 APPS_SCRIPT_URL을 쓰고 싶으면 여기서 자동 적용됩니다.
  const url = env && env.APPS_SCRIPT_URL ? String(env.APPS_SCRIPT_URL).trim() : DEFAULT_APPS_SCRIPT_URL;
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\//.test(url)) {
    throw new Error('Apps Script URL이 올바르지 않습니다.');
  }
  return url;
}

function parseAppsScriptResponse(text, callbackName) {
  const raw = String(text || '').trim();

  // 1) Apps Script가 순수 JSON을 준 경우
  if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
    return JSON.parse(raw);
  }

  // 2) Apps Script가 JSONP를 준 경우: callback({...});
  const startToken = callbackName + '(';
  const start = raw.indexOf(startToken);
  if (start >= 0) {
    const jsonStart = start + startToken.length;
    let jsonEnd = raw.lastIndexOf(');');
    if (jsonEnd < jsonStart) jsonEnd = raw.lastIndexOf(')');
    if (jsonEnd > jsonStart) {
      return JSON.parse(raw.slice(jsonStart, jsonEnd));
    }
  }

  // 3) 다른 callback명이어도 최대한 복구
  const generic = raw.match(/^[\w$]+\((.*)\);?$/s);
  if (generic && generic[1]) {
    return JSON.parse(generic[1]);
  }

  // 4) HTML이 오면 원인을 바로 보이게 함
  throw new Error('Apps Script 응답이 API(JSON/JSONP)가 아닙니다. 응답 앞부분: ' + raw.slice(0, 220));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
