// Cloudflare Pages Function: /api
// 브라우저 대신 Cloudflare가 Apps Script를 호출하게 해서 iPhone/모바일 브라우저 차단 문제를 줄입니다.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhys504lPWXdQsqgkbjEezu_w3XRcrQpyLvoQSy9FMy9Zm0zPtXIzvEvyCd-tM58-0/exec';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function forward(action, payload) {
  if (!action) return jsonResponse({ ok: false, error: 'action이 없습니다.' }, 400);

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('payload', JSON.stringify(Array.isArray(payload) ? payload : []));
  url.searchParams.set('_', Date.now().toString());

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: { 'Accept': 'application/json,text/plain,*/*' }
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: 'Apps Script 응답이 JSON이 아닙니다.',
      detail: text.slice(0, 300)
    }, 502);
  }

  return jsonResponse(data || { ok: false, error: '빈 응답입니다.' }, res.ok ? 200 : 502);
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    return await forward(body.action, body.payload || []);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) }, 500);
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const action = url.searchParams.get('action');
    let payload = [];
    const rawPayload = url.searchParams.get('payload');
    if (rawPayload) payload = JSON.parse(rawPayload);
    return await forward(action, payload);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) }, 500);
  }
}
