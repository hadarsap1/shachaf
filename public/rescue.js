// The only code that still runs when the app itself does not.
//
// index.html names its bundle by hash — /assets/index-<hash>.js. Every deploy
// mints a new hash and the production alias serves only the current build, so a
// client holding an older index (browser HTTP cache, a service worker that
// precached it, a CDN edge that has not caught up) asks for an entry file that
// is gone. The SPA rewrite answers it with index.html, the browser refuses it
// as a module script, and NOTHING in the bundle ever executes: not the error
// boundaries, not the stale-build recovery in lib/chunkRecovery.js, not React.
// The screen stays white. That is "לא מצליח לפתוח".
//
// This file is a plain, unhashed, unbundled script, so it survives that. It
// does three things, in order of how much they cost the user:
//
//   1. Notices the failure — an entry script/stylesheet that errors, or a page
//      that has finished loading and still has an empty #root.
//   2. Repairs what it can: drop the service worker and every cache, re-fetch
//      the document so the browser's own copy is replaced too (a plain reload
//      is allowed to answer from cache — that is why "refresh" did nothing),
//      and reload. Never more often than the shared budget allows.
//   3. When the budget is out, STOPS and says so on screen. An app that keeps
//      reloading itself is an app that flickers and never opens; one that
//      admits it is stuck can at least be reported and retried on purpose.
//
// The budget is the one in src/lib/reloadBudget.js — same key, same format.
// This file cannot import it (it runs before the bundle exists), so the few
// lines below are a deliberate copy. Change one, change the other.
(function () {
  var BUDGET_KEY = 'shachaf_auto_reloads'
  var MAX_AUTO_RELOADS = 3
  var WINDOW_MS = 10 * 60 * 1000

  // How long React gets to put something on screen after the page has finished
  // loading. It renders a spinner almost immediately, so this only has to cover
  // parse+boot — but it waits for `load` first, because a slow phone on a slow
  // network is not a broken build and must not be "repaired".
  var SETTLE_AFTER_LOAD_MS = 5000
  // …and a ceiling, for the case where `load` never fires at all.
  var HARD_TIMEOUT_MS = 25000

  var handled = false
  var detail = ''

  function recent() {
    try {
      var raw = JSON.parse(localStorage.getItem(BUDGET_KEY) || '[]')
      if (!raw || raw.constructor !== Array) return []
      var t = Date.now(), out = []
      for (var i = 0; i < raw.length; i++) {
        if (typeof raw[i] === 'number' && t - raw[i] < WINDOW_MS && raw[i] <= t) out.push(raw[i])
      }
      return out
    } catch (e) { return [] }
  }
  function canReload() {
    try { return recent().length < MAX_AUTO_RELOADS } catch (e) { return false }
  }
  function noteReload() {
    try {
      var list = recent()
      list.push(Date.now())
      localStorage.setItem(BUDGET_KEY, JSON.stringify(list))
    } catch (e) { /* private mode */ }
  }
  function clearBudget() {
    try { localStorage.removeItem(BUDGET_KEY) } catch (e) { /* ignore */ }
  }

  function mounted() {
    var root = document.getElementById('root')
    return !!(root && root.children.length > 0)
  }

  function clearCaches() {
    var jobs = []
    try {
      if ('serviceWorker' in navigator) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister() }))
        }))
      }
    } catch (e) { /* ignore */ }
    try {
      if ('caches' in window) {
        jobs.push(caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k) }))
        }))
      }
    } catch (e) { /* ignore */ }
    return Promise.all(jobs)
  }

  // Replace the browser's cached copy of the document before reloading —
  // otherwise the reload can be served the very index that named the missing
  // file, and nothing changes.
  function reloadFresh() {
    var go = function () { location.reload() }
    try {
      fetch(location.href, { cache: 'reload', credentials: 'same-origin' }).then(go, go)
      setTimeout(go, 4000)      // never hang here waiting on a dead network
    } catch (e) { go() }
  }

  function repair() {
    var go = function () { reloadFresh() }
    clearCaches().then(go, go)
  }

  function retry() {
    // A person pressed the button. That is a better guard than any counter.
    clearBudget()
    repair()
  }

  function giveUp() {
    if (document.getElementById('shachaf-rescue')) return
    var dark = false
    try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches } catch (e) { /* ignore */ }
    var bg = dark ? '#111827' : '#f9fafb'
    var fg = dark ? '#f3f4f6' : '#111827'
    var muted = dark ? '#9ca3af' : '#4b5563'
    var faint = dark ? '#9ca3af' : '#6b7280'
    var chip = dark ? '#1f2937' : '#f3f4f6'
    var wrap = document.createElement('div')
    wrap.id = 'shachaf-rescue'
    wrap.setAttribute('dir', 'rtl')
    wrap.setAttribute('lang', 'he')
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:' + bg + ';' +
      'color:' + fg + ';font-family:Heebo,system-ui,-apple-system,sans-serif;overflow:auto'

    var logo = document.createElement('img')
    logo.src = '/logo.png'
    logo.alt = 'שחף+'
    logo.style.cssText = 'height:52px;width:auto;margin-bottom:4px'
    logo.onerror = function () { logo.remove() }

    var h = document.createElement('h1')
    h.textContent = 'שחף+ לא הצליח להיטען'
    h.style.cssText = 'font-size:20px;font-weight:700;margin:0'

    var p = document.createElement('p')
    p.textContent = 'המכשיר מחזיק גרסה ישנה של האפליקציה, וניסינו לרענן אותה בלי הצלחה. ' +
      'לחיצה על "נסה שוב" מנקה את הגרסה השמורה ומוריד את הגרסה הנוכחית מחדש.'
    p.style.cssText = 'font-size:14px;line-height:1.7;color:' + muted + ';margin:0;max-width:22rem'

    var btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = 'נסה שוב'
    btn.style.cssText = 'background:#2563EB;color:#fff;border:none;border-radius:12px;padding:11px 28px;' +
      'font-size:15px;font-weight:600;cursor:pointer;font-family:inherit'
    btn.onclick = function () {
      btn.disabled = true
      btn.textContent = 'מרענן…'
      retry()
    }

    var hint = document.createElement('p')
    hint.textContent = 'אם זה חוזר גם אחרי כמה ניסיונות — ספרו לנו, וצרפו את השורה הבאה:'
    hint.style.cssText = 'font-size:12px;color:' + faint + ';margin:6px 0 0'

    var code = document.createElement('code')
    // LTR-only content: a Hebrew label inside this box would render reversed.
    code.textContent = (detail || 'app-did-not-mount') + '  ' +
      new Date().toISOString().slice(0, 16).replace('T', ' ')
    code.style.cssText = 'font-size:11px;color:' + faint + ';background:' + chip + ';border-radius:8px;' +
      'padding:6px 10px;direction:ltr;unicode-bidi:isolate;overflow-wrap:anywhere;max-width:22rem;' +
      'display:inline-block;line-height:1.6'

    wrap.appendChild(logo)
    wrap.appendChild(h)
    wrap.appendChild(p)
    wrap.appendChild(btn)
    wrap.appendChild(hint)
    wrap.appendChild(code)
    document.body.appendChild(wrap)
  }

  function fail(what) {
    if (handled || mounted()) return
    handled = true
    detail = what || ''
    if (canReload()) { noteReload(); repair() } else { giveUp() }
  }

  // A missing entry bundle does not throw and does not reject — the browser
  // fires `error` on the element and stops. Capture phase: these never bubble.
  window.addEventListener('error', function (e) {
    var el = e && e.target
    if (!el || el === window || !el.tagName) return
    var tag = el.tagName.toUpperCase()
    if (tag !== 'SCRIPT' && tag !== 'LINK') return
    var url = el.src || el.href || ''
    // Only our own build. A blocked analytics tag is not a reason to wipe
    // the user's caches and reload.
    if (url.indexOf('/assets/') === -1) return
    fail(url.replace(location.origin, ''))
  }, true)

  var armed = false
  function arm() {
    if (armed) return
    armed = true
    setTimeout(function () { if (!mounted()) fail('') }, SETTLE_AFTER_LOAD_MS)
  }
  if (document.readyState === 'complete') arm()
  else window.addEventListener('load', arm)
  setTimeout(function () { if (!mounted()) fail('') }, HARD_TIMEOUT_MS)
})()
