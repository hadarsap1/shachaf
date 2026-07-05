// SW rescue: if the app fails to mount (stale/broken service worker cache),
// unregister all SWs, wipe caches, and reload once.
// External file (not inline) so the CSP script-src 'self' allows it.
setTimeout(function () {
  var root = document.getElementById('root')
  if (root && root.children.length > 0) return
  if (sessionStorage.getItem('sw_rescue')) return
  sessionStorage.setItem('sw_rescue', '1')
  var done = function () { location.reload() }
  Promise.all([
    'serviceWorker' in navigator
      ? navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister() }))
        })
      : Promise.resolve(),
    'caches' in window
      ? caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k) }))
        })
      : Promise.resolve(),
  ]).then(done, done)
}, 6000)
