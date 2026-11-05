(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================
     1. SCENES: each nav item swaps the visible "scene"
        (fade out, then bounce in). Uses #hash so the
        back button and direct links like /#projects work.
     ===================================================== */
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var sceneIds = scenes.map(function (s) { return s.id; });
  var navLinks = document.querySelectorAll('.nav-link');
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('nav-menu');
  var current = null;
  var timer = null;

  // Stagger the pop-in of items inside each scene
  scenes.forEach(function (scene) {
    var items = scene.querySelectorAll('.card, .pop');
    Array.prototype.forEach.call(items, function (el, i) { el.style.setProperty('--i', i); });
  });

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('open', open);
  }

  function markNav(id) {
    Array.prototype.forEach.call(navLinks, function (a) {
      if (a.getAttribute('data-scene') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function showScene(id, userInitiated) {
    if (sceneIds.indexOf(id) === -1) id = 'home';
    if (id === current) return;

    var next = document.getElementById(id);
    var prev = current ? document.getElementById(current) : null;
    current = id;
    markNav(id);
    setMenu(false);
    clearTimeout(timer);

    function enter() {
      scenes.forEach(function (s) { s.classList.remove('is-active', 'is-leaving'); });
      window.scrollTo(0, 0);
      next.classList.add('is-active');
      if (userInitiated) {
        next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: true });
      }
      Array.prototype.forEach.call(next.querySelectorAll('.carousel'), refreshCarousel);
    }

    if (prev && !reduce) {
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      timer = setTimeout(enter, 220);
    } else {
      enter();
    }
  }

  function isScene(id) { return sceneIds.indexOf(id) !== -1; }

  // Click on any element that has data-scene
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-scene]') : null;
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('data-scene');
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    showScene(id, true);
  });

  // Back / forward buttons and typed URLs
  function onHash() {
    var id = location.hash.replace('#', '');
    if (isScene(id)) showScene(id, false);
    else if (!current) showScene('home', false);
  }
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onHash);

  // Back to top link in the footer
  var topLink = document.querySelector('.back-to-top');
  if (topLink) {
    topLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
  }

  /* =====================================================
     2. CAROUSEL: swipe / arrows / dots / keyboard.
        Controls only appear when there is 2+ images.
     ===================================================== */
  var carouselApi = new WeakMap();

  function initCarousel(c) {
    var track = c.querySelector('.carousel-track');
    if (!track) return;
    var n = track.children.length;
    if (n < 2) return;

    var prevBtn = makeBtn('carousel-btn prev', 'Previous image', '‹');
    var nextBtn = makeBtn('carousel-btn next', 'Next image', '›');
    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'carousel-dots';
    var count = document.createElement('span');
    count.className = 'carousel-count';
    count.setAttribute('aria-live', 'polite');

    var dots = [];
    for (var i = 0; i < n; i++) {
      (function (k) {
        var d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', 'Go to image ' + (k + 1));
        d.addEventListener('click', function () { goTo(k); });
        dotsWrap.appendChild(d);
        dots.push(d);
      })(i);
    }

    c.appendChild(prevBtn);
    c.appendChild(nextBtn);
    c.appendChild(dotsWrap);
    c.appendChild(count);

    track.setAttribute('tabindex', '0');
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', 'Image carousel, use left and right arrow keys');

    function makeBtn(cls, label, text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.setAttribute('aria-label', label);
      b.textContent = text;
      return b;
    }

    function index() {
      var w = track.clientWidth;
      return w ? Math.round(track.scrollLeft / w) : 0;
    }
    function update() {
      var i = Math.max(0, Math.min(n - 1, index()));
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
      count.textContent = (i + 1) + ' / ' + n;
    }
    function goTo(i) {
      i = (i + n) % n;
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }

    prevBtn.addEventListener('click', function () { goTo(index() - 1); });
    nextBtn.addEventListener('click', function () { goTo(index() + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index() - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index() + 1); }
    });

    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    window.addEventListener('resize', function () {
      track.scrollLeft = index() * track.clientWidth;
      update();
    });

    carouselApi.set(c, update);
    update();
  }

  function refreshCarousel(c) {
    var fn = carouselApi.get(c);
    if (fn) fn();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.carousel'), initCarousel);

  /* =====================================================
     3. "MORE DETAILS" POPUP
        Reads the images from the project's carousel, and the
        text from its hidden .project-details block.
     ===================================================== */
  var modal = document.getElementById('project-modal');
  var modalBody = modal ? modal.querySelector('.modal-content') : null;
  var closeBtn = modal ? modal.querySelector('.modal-close') : null;

  function openDetails(card) {
    var details = card.querySelector('.project-details');
    var imgs = card.querySelectorAll('.carousel-track img');
    modalBody.innerHTML = '';

    var c = document.createElement('div');
    c.className = 'carousel';
    var t = document.createElement('div');
    t.className = 'carousel-track';
    Array.prototype.forEach.call(imgs, function (img) {
      var copy = img.cloneNode(true);
      copy.removeAttribute('loading');
      t.appendChild(copy);
    });
    c.appendChild(t);
    modalBody.appendChild(c);

    var text = document.createElement('div');
    text.className = 'modal-text';
    var h = document.createElement('h3');
    h.id = 'modal-title';
    h.textContent = card.querySelector('h3').textContent;
    var role = document.createElement('p');
    role.className = 'project-role';
    role.textContent = card.querySelector('.project-role').textContent;
    text.appendChild(h);
    text.appendChild(role);
    if (details) {
      var inner = document.createElement('div');
      inner.innerHTML = details.innerHTML; // trusted: comes from this page's own markup
      text.appendChild(inner);
    }
    var tags = card.querySelector('.tags');
    if (tags) {
      var tagTitle = document.createElement('h4');
      tagTitle.textContent = 'Tech stack';
      text.appendChild(tagTitle);
      text.appendChild(tags.cloneNode(true));
    }
    modalBody.appendChild(text);

    document.body.classList.add('no-scroll');
    modal.showModal();
    modal.scrollTop = 0;
    initCarousel(c);
  }

  if (modal && modalBody) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-details]'), function (btn) {
      btn.addEventListener('click', function () {
        openDetails(btn.closest('.project-card'));
      });
    });
    closeBtn.addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
    modal.addEventListener('close', function () {
      document.body.classList.remove('no-scroll');
      modalBody.innerHTML = '';
    });
  }

  /* =====================================================
     4. START
     ===================================================== */
  var start = location.hash.replace('#', '');
  showScene(isScene(start) ? start : 'home', false);
})();
