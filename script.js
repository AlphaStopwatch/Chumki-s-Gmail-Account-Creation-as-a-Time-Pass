"use strict";

/* ==========================================================================
   MY GMAIL ACCOUNT — Infinite account-age stopwatch

   The starting point below is permanent. Elapsed time is always recalculated
   from it with Date.now(), so refreshing, closing the browser, sleeping the
   device or going offline can never change the result.

   NOTE: SECRET_ENCRYPTION is plain text inside this file. Anyone who can load
   or inspect this page can read it. Keeping it out of the interface is a
   convenience, not a security boundary.
   ========================================================================== */

/* Permanent starting point: November 6, 2026, 9:25:00 AM, Asia/Dhaka (UTC+06:00) */
const STOPWATCH_START = "2026-11-06T09:25:00+06:00";

/* Immutable string. Never displayed, never transmitted. */
const SECRET_ENCRYPTION = "AK2.AKN5JQXgIcySdHqIO00bSq5QYBb5b6xkrR2nyQ1ZBYxR4paZJmSFMbVp9KPVFbVvhTipfKvECstnFmOHBXV_KCLjIyD34Muu-bc4kgeKhy9XjTHIbGQCwknu34H8t-bx2259fXs5hlJMNSIsPRr1uErhtY1okBMqq7p-aQbm_2Scm5z-Q6j6IWg-HKLamnJs3yAUpJULRJOIAB6ZeMfxTJLBRCceKghasj_UlPc";

(function () {
  var START_MS = new Date(STOPWATCH_START).getTime();
  var MS_SECOND = 1000n;
  var MS_MINUTE = 60000n;
  var MS_HOUR = 3600000n;
  var MS_DAY = 86400000n;
  var MIN_DAY_DIGITS = 4;

  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = reduceMotionQuery.matches;
  var onMotionChange = function (e) { reduceMotion = e.matches; };
  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", onMotionChange);
  } else if (reduceMotionQuery.addListener) {
    reduceMotionQuery.addListener(onMotionChange);
  }

  /* ---------------- Rolling digit columns ---------------- */

  function buildDigit() {
    var win = document.createElement("span");
    win.className = "d";
    var strip = document.createElement("span");
    strip.className = "strip";
    /* 0–9 plus a trailing 0 so 9 → 0 keeps rolling in the same direction */
    for (var i = 0; i <= 10; i++) {
      var s = document.createElement("span");
      s.textContent = String(i % 10);
      strip.appendChild(s);
    }
    win.appendChild(strip);
    return { win: win, strip: strip, value: -1 };
  }

  function finishWrap(d) {
    if (!d.wrapping) return;
    d.wrapping = false;
    d.strip.classList.add("no-anim");
    d.strip.style.setProperty("--i", "0");
    void d.strip.offsetHeight; /* commit the snap before transitions return */
    d.strip.classList.remove("no-anim");
  }

  function setDigit(d, value, animate) {
    if (d.value === value) return;
    finishWrap(d);
    var prev = d.value;
    d.value = value;

    if (!animate || reduceMotion || prev < 0) {
      d.strip.classList.add("no-anim");
      d.strip.style.setProperty("--i", String(value));
      void d.strip.offsetHeight;
      d.strip.classList.remove("no-anim");
      return;
    }

    if (prev === 9 && value === 0) {
      d.wrapping = true;
      d.strip.style.setProperty("--i", "10");
      var done = function (e) {
        if (e && e.propertyName !== "transform") return;
        d.strip.removeEventListener("transitionend", done);
        finishWrap(d);
      };
      d.strip.addEventListener("transitionend", done);
    } else {
      d.strip.style.setProperty("--i", String(value));
    }
  }

  function Group(el) {
    this.el = el;
    this.digits = [];
    this.text = "";
  }

  Group.prototype.set = function (text, animate) {
    if (text.length !== this.digits.length) {
      /* Day counter grew: add columns on the left, never limit the size */
      while (this.digits.length < text.length) {
        var d = buildDigit();
        this.digits.unshift(d);
        this.el.insertBefore(d.win, this.el.firstChild);
      }
      animate = false;
      this.digits.forEach(function (d) { d.value = -1; });
    }
    for (var i = 0; i < text.length; i++) {
      setDigit(this.digits[i], text.charCodeAt(i) - 48, animate);
    }
    this.text = text;
  };

  var clock = document.getElementById("clock");
  var groups = {
    days: new Group(document.getElementById("days")),
    hours: new Group(document.getElementById("hours")),
    minutes: new Group(document.getElementById("minutes")),
    seconds: new Group(document.getElementById("seconds"))
  };
  var srText = document.getElementById("clock-sr");

  /* ---------------- Elapsed-time calculation ---------------- */

  function pad2(n) { return n < 10n ? "0" + n : String(n); }

  var lastRenderAt = 0;
  var lastMinuteKey = "";

  function render() {
    var now = Date.now();

    /* BigInt arithmetic: no maximum number of days, no precision loss */
    var elapsed = BigInt(now) - BigInt(START_MS);
    if (elapsed < 0n) elapsed = 0n; /* before the starting point: show zeros */

    var days = elapsed / MS_DAY;
    var hours = (elapsed % MS_DAY) / MS_HOUR;
    var minutes = (elapsed % MS_HOUR) / MS_MINUTE;
    var seconds = (elapsed % MS_MINUTE) / MS_SECOND;

    var dayText = String(days);
    while (dayText.length < MIN_DAY_DIGITS) dayText = "0" + dayText;

    /* Roll only for a normal one-second tick; snap after sleep or tab restore */
    var animate = lastRenderAt !== 0 && now - lastRenderAt < 2500 && !document.hidden;
    lastRenderAt = now;

    if (clock.style.getPropertyValue("--n") !== String(dayText.length)) {
      clock.style.setProperty("--n", String(dayText.length));
    }

    groups.days.set(dayText, animate);
    groups.hours.set(pad2(hours), animate);
    groups.minutes.set(pad2(minutes), animate);
    groups.seconds.set(pad2(seconds), animate);

    var minuteKey = dayText + ":" + hours + ":" + minutes;
    if (minuteKey !== lastMinuteKey) {
      lastMinuteKey = minuteKey;
      srText.textContent =
        days + (days === 1n ? " day, " : " days, ") +
        hours + (hours === 1n ? " hour, and " : " hours, and ") +
        minutes + (minutes === 1n ? " minute" : " minutes");
    }
  }

  /* ---------------- Scheduling ---------------- */

  var timer = 0;

  function tick() {
    render();
    /* Aim just after the next whole second since the start, to stay in step */
    var into = (Date.now() - START_MS) % 1000;
    if (into < 0) into += 1000;
    timer = window.setTimeout(tick, 1000 - into + 12);
  }

  function resync() {
    window.clearTimeout(timer);
    lastRenderAt = 0; /* snap to the correct value without rolling */
    tick();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      window.clearTimeout(timer);
    } else {
      resync();
    }
  });
  window.addEventListener("pageshow", resync);
  window.addEventListener("focus", resync);
  window.addEventListener("online", resync);

  tick();

  /* ---------------- Ambient particles (decorative, lightweight) ---------------- */

  (function makeParticles() {
    var host = document.getElementById("particles");
    if (!host || reduceMotion) return;
    var small = Math.min(window.innerWidth, window.innerHeight) < 600;
    var count = small ? 12 : 22;
    var colors = ["#b69cff", "#8b5cf6", "#67e8f9", "#ffffff"];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var p = document.createElement("span");
      p.className = "particle";
      var st = p.style;
      st.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
      st.setProperty("--y", (35 + Math.random() * 65).toFixed(1) + "%");
      st.setProperty("--s", (1.5 + Math.random() * 2.5).toFixed(1) + "px");
      st.setProperty("--c", colors[i % colors.length]);
      st.setProperty("--o", (0.25 + Math.random() * 0.45).toFixed(2));
      st.setProperty("--t", (14 + Math.random() * 18).toFixed(1) + "s");
      st.setProperty("--d", (-Math.random() * 20).toFixed(1) + "s");
      st.setProperty("--dx", ((Math.random() - 0.5) * 12).toFixed(1) + "vw");
      frag.appendChild(p);
    }
    host.appendChild(frag);
  })();

  /* ---------------- Copy secret ---------------- */

  var button = document.getElementById("copy-btn");
  var toast = document.getElementById("toast");
  var toastTimer = 0;

  function showMessage(ok) {
    window.clearTimeout(toastTimer);
    toast.textContent = ok ? "Secret copied successfully." : "Unable to copy. Please try again.";
    toast.className = "toast show " + (ok ? "ok" : "err");
    button.classList.remove("is-success", "is-error");
    button.classList.add(ok ? "is-success" : "is-error");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("show");
      button.classList.remove("is-success", "is-error");
    }, 3500);
  }

  /* Legacy fallback: a temporary, invisible, off-screen field that is removed at once */
  function legacyCopy(text) {
    var field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.tabIndex = -1;
    field.style.cssText =
      "position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(field);
    var ok = false;
    try {
      field.select();
      field.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    } finally {
      field.value = "";
      document.body.removeChild(field);
    }
    return ok;
  }

  function copySecret() {
    var text = SECRET_ENCRYPTION; /* read the original constant; never modified */

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  button.addEventListener("click", function () {
    copySecret().then(showMessage, function () { showMessage(false); });
  });
})();
