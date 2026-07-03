// Dolphin ERP v12.2 Cloudflare Pages Function
// 브라우저가 Apps Script를 직접 호출하지 않고, Cloudflare가 중간에서 대신 호출합니다.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhys504lPWXdQsqgkbjEezu_w3XRcrQpyLvoQSy9FMy9Zm0zPtXIzvEvyCd-tM58-0/exec';

export async function onRequest(context) {
  const request = context.request;

  try {
    let action = '';
    let args = [];

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      action = String(body.action || '').trim();
      args = Array.isArray(body.args) ? body.args : [];
    } else {
      const u = new URL(request.url);
      action = String(u.searchParams.get('action') || '').trim();
      const payload = u.searchParams.get('payload');
      if (payload) {
        const parsed = JSON.parse(payload);
        args = Array.isArray(parsed) ? parsed : [parsed];
      }
    }

    if (!action) {
      return json({ ok: false, error: 'action이 없습니다.' }, 400);
    }

    const target = new URL(APPS_SCRIPT_URL);
    target.searchParams.set('action', action);
    target.searchParams.set('payload', JSON.stringify(args));
    target.searchParams.set('_', Date.now().toString());

    const res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'User-Agent': 'DolphinERP-Cloudflare-Proxy/12.2'
      }
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return json({
        ok: false,
        error: 'Apps Script 응답이 JSON이 아닙니다.',
        status: res.status,
        preview: text.slice(0, 500)
      }, 502);
    }

    return json(data, res.ok ? 200 : 502);
  } catch (err) {
    return json({ ok: false, error: err && err.message ? err.message : String(err) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
