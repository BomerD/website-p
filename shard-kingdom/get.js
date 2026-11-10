// The Google Play buttons on Shard Kingdom's pages (the game's page and play/).
//
// Social apps open links in their own browser, and on Android many of them do nothing with a link to
// play.google.com (Instagram's, 2026-11-07). So a button, an <a data-play>, opens the Play Store app itself
// (market://) inside those apps, Chrome's way (intent://) in other Android browsers, and the web page elsewhere;
// an <a data-play-web> is always the web page. Still on the page a moment after the tap, the [data-play-help] box
// says how to open the page in Chrome. [data-ios] shows only on iPhones and iPads.
//
// Where the visitor came from (?utm_source=instagram&utm_campaign=bio in the page's address, or else the script
// tag's data-source and data-campaign) goes on to Google Play as the install referrer, which Play Console's
// acquisition reports show.
(function () {
  var ID = "com.bomerd.conveyorkingdom";
  var me = document.currentScript || {};
  var defaults = me.dataset || {};
  var q = new URLSearchParams(location.search);
  function clean(v) { return (v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40); }
  function tag(name, fallback) { return clean(q.get(name)) || clean(fallback); }

  var source = tag("utm_source", defaults.source || "website");
  var medium = tag("utm_medium", source === "website" ? "web" : "social");
  var campaign = tag("utm_campaign", defaults.campaign || "page");
  var query = "id=" + ID + "&referrer=" +
    encodeURIComponent("utm_source=" + source + "&utm_medium=" + medium + "&utm_campaign=" + campaign);
  var web = "https://play.google.com/store/apps/details?" + query;
  var market = "market://details?" + query;
  var intent = "intent://details?" + query + "#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=" +
    encodeURIComponent(web) + ";end";

  var ua = navigator.userAgent || "";
  var android = /Android/i.test(ua);
  var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|Threads|Barcelona|musical_ly|TikTok|Bytedance|Snapchat|Pinterest|Twitter|LinkedInApp|Line\//i.test(ua);

  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }

  function wire() {
    each("a[data-play-web]", function (a) { a.href = web; });
    each("[data-ios]", function (e) { e.hidden = !ios; });
    each("a[data-play]", function (a) {
      a.href = android ? (inApp ? market : intent) : web;
      if (!android) return;
      a.addEventListener("click", function () {
        var left = false;
        function away() { left = true; }
        document.addEventListener("visibilitychange", function () { if (document.hidden) away(); });
        window.addEventListener("pagehide", away);
        window.addEventListener("blur", away);
        setTimeout(function () { if (!left) each("[data-play-help]", function (e) { e.hidden = false; }); }, 1500);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
