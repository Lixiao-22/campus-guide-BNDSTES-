/* 校园绿镜 · 前端逻辑（无任何外部依赖） */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FALLBACK_LANGS = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'ru', label: 'Русский' },
    { code: 'ar', label: 'العربية', rtl: true }
  ];
  let LANG_META = FALLBACK_LANGS;
  let LANGS = FALLBACK_LANGS.map((l) => l.code);
  const HTML_LANG = { zh: 'zh-CN', en: 'en', ja: 'ja', fr: 'fr', de: 'de', es: 'es', ru: 'ru', ar: 'ar' };
  const TTS_LANG = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', ru: 'ru-RU', ar: 'ar-SA' };
  const isRTL = (code) => {
    const m = LANG_META.find((x) => x.code === code);
    return !!(m && m.rtl) || code === 'ar';
  };

  const state = {
    lang: 'zh',
    data: null,
    idx: -1,
    speaking: false
  };

  /* 本机（Node 服务）与静态托管（GitHub Pages）共用同一份前端：
   * 静态版由构建脚本注入 config.js 覆盖这几项。 */
  const CFG = Object.assign(
    { static: false, contentDir: 'content/', chatUrl: '/api/chat' },
    window.GM_CONFIG || {}
  );

  function contentUrl(lang) {
    if (CFG.static) return (CFG.contentDir || 'content/') + (lang || 'zh') + '.json';
    return '/api/content?lang=' + encodeURIComponent(lang || '');
  }

  /* ------------------------------ 语言 ------------------------------ */
  function detectLang() {
    const saved = localStorage.getItem('gm.lang');
    if (LANGS.includes(saved)) return saved;
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    const n = (navigator.language || 'zh').toLowerCase();
    if (n.startsWith('ja')) return 'ja';
    if (n.startsWith('en')) return 'en';
    return 'zh';
  }

  const t = (obj) => (obj && (obj[state.lang] || obj.zh)) || '';

  async function loadContent(lang) {
    const res = await fetch(contentUrl(lang), { cache: 'no-cache' });
    if (!res.ok) throw new Error('content ' + res.status);
    return res.json();
  }

  let langToken = 0;
  async function setLang(lang, silent) {
    if (!LANGS.includes(lang)) lang = 'zh';
    state.lang = lang;
    localStorage.setItem('gm.lang', lang);
    document.documentElement.lang = HTML_LANG[lang] || lang;
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    syncLangUI();
    if (!silent) stopSpeak();

    // 服务端按语言裁剪内容，只下载这一门语言（体积约为全部语言的 1/8）
    const my = ++langToken;
    try {
      const data = await loadContent(lang);
      if (my !== langToken) return; // 用户又切了别的语言，丢弃这次结果
      state.data = data;
    } catch (e) {
      if (my !== langToken) return; // 拉取失败就沿用现有内容
    }
    if (state.data) {
      renderAll();
      if (state.idx >= 0) renderSheet(state.idx, true);
    }
  }

  /* 语言下拉：按钮文案 + 菜单选中态 */
  function syncLangUI() {
    const cur = LANG_META.find((l) => l.code === state.lang) || LANG_META[0];
    $('#langCur').textContent = cur.label;
    $$('#langMenu button').forEach((b) => {
      const on = b.dataset.lang === state.lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function buildLangMenu() {
    const menu = $('#langMenu');
    menu.innerHTML = LANG_META.map((l) => `
      <button type="button" role="menuitemradio" data-lang="${l.code}" aria-checked="false">
        <span>${escapeHtml(l.label)}</span><code>${l.code}</code>
      </button>`).join('');
    syncLangUI();
  }

  function toggleLangMenu(force) {
    const menu = $('#langMenu');
    const btn = $('#langBtn');
    const open = typeof force === 'boolean' ? force : menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ------------------------------ 渲染 ------------------------------ */
  function renderAll() {
    const d = state.data;
    const site = d.site;
    const ui = d.ui;

    document.title = t(site.school);

    const bn = $('#brandName');
    if (bn) bn.textContent = t(site.schoolShort);
    $('#heroKicker').textContent = t(site.hero.kicker);
    $('#schoolName').textContent = t(site.school);
    $('#heroLead').textContent = t(site.hero.lead);
    $('#ctaPrimary').textContent = t(site.hero.ctaPrimary);
    $('#ctaSecondary').textContent = t(site.hero.ctaSecondary);

    $('#stats').innerHTML = site.highlights
      .map((h) => `<li><b>${h.num}</b>${t(h.label)}</li>`)
      .join('');

    // 完整影像（首页不再放学生语音讲解）
    const hasFull = !!site.intro.full;
    const introBox = $('#introAudio');
    if (introBox) introBox.hidden = !hasFull;
    const fullBtnEl = $('#introFullBtn');
    if (fullBtnEl) {
      fullBtnEl.hidden = !hasFull;
      if (hasFull) $('#introFullLabel').textContent = t(site.intro.fullLabel);
    }

    $('#filmTitle').textContent = t(site.intro.title);
    $('#filmText').textContent = t(site.intro.text);
    $('#filmPoster').style.backgroundImage = `url("${site.intro.poster}")`;
    $('#filmCap').textContent = t(ui.videoTitle);

    $('#chooseTitle').textContent = t(site.chooseTitle);
    $('#chooseSub').textContent = t(site.chooseSub);

    $('#footSchool').textContent = t(site.school);
    $('#footNote').textContent = t(site.footerNote);
    $('#qrBtnText').textContent = t(ui.scanHint);

    renderGrid();
    renderSheetChrome();
    aiSyncCopy();
  }

  function renderGrid() {
    const d = state.data;
    const grid = $('#grid');
    grid.innerHTML = d.communities.map((c, i) => {
      const local = c[state.lang] || c.zh;
      const num = c.no || String(i + 1).padStart(2, '0');
      const media = c.thumb
        ? `<img src="${c.thumb}" alt="${escapeHtml(local.name)}" loading="lazy" decoding="async">`
        : `<span class="card-noimg"><img src="media/img/mascot-300.webp" alt="" aria-hidden="true" loading="lazy"></span>`;
      const tags = (local.tags || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join('');
      return `
      <button class="card reveal" type="button" data-idx="${i}" style="transition-delay:${Math.min(i * 45, 260)}ms">
        <div class="card-media${c.cover ? '' : ' is-empty'}"${c.cover ? '' : ` style="--accent:${c.accent || '#1c6b4a'}"`}>
          <span class="card-num">${escapeHtml(num)}</span>
          ${c.cover ? '' : `<span class="card-ph">${escapeHtml(t(state.data.ui.noPhoto) || '')}</span>`}
          ${media}
          <span class="card-name">${escapeHtml(local.name)}</span>
        </div>
        <div class="card-foot">
          <div class="card-tags">${tags}</div>
          <span class="card-go" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </button>`;
    }).join('');

    $$('.card', grid).forEach((el) => {
      el.addEventListener('click', () => navigate(Number(el.dataset.idx)));
    });
    observeReveal();
  }

  function renderSheetChrome() {
    const ui = state.data.ui;
    $('#backBtn').textContent = t(ui.backToList);
    $('#galleryTitle').textContent = t(ui.photos);
  }

  /* ------------------------------ 社区详情 ------------------------------ */
  function renderSheet(idx, keepScroll) {
    const d = state.data;
    const ui = d.ui;
    const c = d.communities[idx];
    if (!c) return;
    const local = c[state.lang] || c.zh;
    const panel = $('#sheet .sheet-panel');

    // 头图
    const heroImg = c.cover || (c.gallery && c.gallery[0]) || '';
    const hero = $('#sheetHeroImg');
    if (heroImg) {
      hero.style.backgroundImage = `url("${heroImg}")`;
      hero.style.opacity = '1';
      hero.innerHTML = '';
      hero.removeAttribute('data-icon');
    } else {
      hero.style.backgroundImage = `radial-gradient(120% 120% at 20% 0%, ${c.accent || '#1c6b4a'}, #0e3a2a 70%)`;
      hero.innerHTML = '<img class="sheet-mascot" src="media/img/mascot.webp" alt="" aria-hidden="true">';
      hero.setAttribute('data-icon', c.icon || '');
    }
    const badge = $('#sheetBadge');
    if (badge) {
      badge.hidden = !!heroImg;
      badge.textContent = heroImg ? '' : (c.icon || '');
    }
    const num = c.no || String(idx + 1).padStart(2, '0');
    $('#sheetIndex').innerHTML =
      `<span dir="ltr">${num} / ${String(d.communities.length).padStart(2, '0')}</span> · ${t(ui.communityWord)}`;
    $('#sheetName').textContent = local.name;
    $('#sheetTags').innerHTML = (local.tags || []).map((x) => `<span>${escapeHtml(x)}</span>`).join('');

    // 工具条：中文 / English 讲解
    const tools = [];
    const hasZh = !!c.audioZh;
    const hasEn = !!c.audioEn;
    if (hasZh) {
      tools.push(`<button class="tool" type="button" data-audio-toggle="zh">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 9v6h3l5 4V5L7 9H4z" fill="currentColor"/></svg>
        ${escapeHtml(t(ui.audioZh) || '中文讲解')}</button>`);
    } else if (window.speechSynthesis) {
      tools.push(`<button class="tool" type="button" data-speak>
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 9v6h3l5 4V5L7 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
        <span data-speak-label>${escapeHtml(t(ui.audioZh) || t(ui.listen))}</span></button>`);
    }
    if (hasEn) {
      tools.push(`<button class="tool" type="button" data-audio-toggle="en">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 9v6h3l5 4V5L7 9H4z" fill="currentColor"/></svg>
        ${escapeHtml(t(ui.audioEn) || 'English')}</button>`);
    }
    if (c.video) {
      tools.push(`<button class="tool" type="button" data-video>
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
        ${escapeHtml(t(ui.videoTitle))}</button>`);
    }
    $('#sheetTools').innerHTML = tools.join('');
    $('#sheetTools').hidden = tools.length === 0;

    // 正文
    $('#sheetProse').innerHTML = local.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('');

    // 相册（去掉已作为头图的那张）
    const photos = (c.gallery || []).filter((g) => g !== c.cover);
    if (photos.length) {
      $('#galleryBlock').hidden = false;
      $('#gallery').innerHTML = photos
        .map((g) => `<img src="${g}" alt="${escapeHtml(local.name)}" loading="lazy" decoding="async" data-full="${g}">`)
        .join('');
    } else {
      $('#galleryBlock').hidden = true;
      $('#gallery').innerHTML = '';
    }

    // 音频：中文 / English 双轨
    const ab = $('#audioBlock');
    const rows = [];
    if (hasZh) {
      rows.push(`<div class="au-row" data-track="zh">
        <span class="au-tag">中文</span>
        <div class="au-main">
          <p class="au-label">${escapeHtml(t(ui.audioZh) || '中文讲解')}</p>
          <audio controls preload="metadata" src="${c.audioZh}"></audio>
        </div>
      </div>`);
    } else if (window.speechSynthesis) {
      rows.push(`<div class="au-row is-ai" data-track="zh">
        <span class="au-tag">中文</span>
        <div class="au-main">
          <p class="au-label">${escapeHtml(t(ui.audioZh) || '中文讲解')} <em class="ai-badge">${escapeHtml(t(ui.aiBadge) || 'AI 生成')}</em></p>
          <button class="au-ai" type="button" data-speak>
            <svg viewBox="0 0 24 24" width="15" height="15"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
            <span data-speak-label>${escapeHtml(t(ui.listen) || 'AI 语音')}</span>
          </button>
        </div>
      </div>`);
    }
    if (hasEn) {
      rows.push(`<div class="au-row" data-track="en">
        <span class="au-tag">EN</span>
        <div class="au-main">
          <p class="au-label">${escapeHtml(t(ui.audioEn) || 'English')}</p>
          <audio controls preload="metadata" src="${c.audioEn}"></audio>
        </div>
      </div>`);
    }
    ab.hidden = rows.length === 0;
    ab.innerHTML = rows.join('');

    /* 高亮当前播放的轨道 */
    $$('audio', ab).forEach((a) => {
      const row = a.closest('.au-row');
      const tool = $(`[data-audio-toggle="${row.dataset.track}"]`);
      a.addEventListener('play', () => {
        $$('audio', ab).forEach((o) => { if (o !== a) o.pause(); });
        row.classList.add('playing');
        if (tool) tool.classList.add('on');
      });
      a.addEventListener('pause', () => { row.classList.remove('playing'); if (tool) tool.classList.remove('on'); });
      a.addEventListener('ended', () => { row.classList.remove('playing'); if (tool) tool.classList.remove('on'); });
    });

    // 上一个 / 下一个
    const prev = d.communities[idx - 1];
    const next = d.communities[idx + 1];
    const pb = $('#prevBtn'), nb = $('#nextBtn');
    pb.disabled = !prev;
    nb.disabled = !next;
    const rtl = isRTL(state.lang);
    pb.textContent = prev ? (rtl ? '→ ' : '← ') + (prev[state.lang] || prev.zh).name : t(ui.prev);
    nb.textContent = next ? (next[state.lang] || next.zh).name + (rtl ? ' ←' : ' →') : t(ui.next);

    if (!keepScroll) panel.scrollTop = 0;
  }

  function openSheet(idx) {
    const ia = $('#introAudioEl');
    if (ia && !ia.paused) ia.pause();
    const sheet = $('#sheet');
    const wasHidden = sheet.hidden;
    sheet.hidden = false;
    document.body.classList.add('locked');
    state.idx = idx;
    renderSheet(idx);
    if (wasHidden) {
      const panel = $('#sheet .sheet-panel');
      panel.scrollTop = 0;
    }
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    document.body.classList.remove('locked');
    state.idx = -1;
    stopSpeak();
  }

  /* ------------------------------ 哈希路由 ------------------------------ */
  function navigate(idx) {
    const c = state.data.communities[idx];
    if (!c) return;
    location.hash = '#/c/' + c.id;
  }

  function syncFromHash() {
    if (!state.data) return;
    const m = /^#\/c\/([\w-]+)$/.exec(location.hash);
    if (m) {
      const idx = state.data.communities.findIndex((x) => x.id === m[1]);
      if (idx >= 0) { openSheet(idx); return; }
    }
    if (!$('#sheet').hidden) closeSheet();
  }

  /* ------------------------------ 语音朗读 ------------------------------ */
  function stopSpeak() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.speaking = false;
    const btn = $('[data-speak]');
    if (btn) {
      btn.classList.remove('on');
      const lab = $('[data-speak-label]');
      if (lab && state.data) lab.textContent = t(state.data.ui.listen);
    }
  }

  function speak(text, langCode) {
    if (!window.speechSynthesis) return;
    if (state.speaking) { stopSpeak(); return; }
    const code = langCode || state.lang;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG[code] || 'zh-CN';
    u.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.onend = () => stopSpeak();
    u.onerror = () => stopSpeak();
    state.speaking = true;
    const btn = $('[data-speak]');
    if (btn) {
      btn.classList.add('on');
      const lab = $('[data-speak-label]', btn);
      if (lab && state.data) lab.textContent = t(state.data.ui.stopListen);
    }
    window.speechSynthesis.speak(u);
  }

  /* ------------------------------ 影片 / 图片 / 二维码 ------------------------------ */
  function playVideo(src, cap) {
    if (!src) return;
    const ia = $('#introAudioEl');
    if (ia && !ia.paused) ia.pause();
    const modal = $('#videoModal');
    const player = $('#player');
    $('#videoCap').textContent = cap || '';
    player.src = src;
    modal.hidden = false;
    document.body.classList.add('locked');
    const p = player.play();
    if (p && p.catch) p.catch(() => {});
  }

  function closeVideo() {
    const player = $('#player');
    try { player.pause(); } catch (e) {}
    player.removeAttribute('src');
    try { player.load(); } catch (e) {}
    $('#videoModal').hidden = true;
    if ($('#sheet').hidden) document.body.classList.remove('locked');
  }

  function openLightbox(src) {
    $('#lightboxImg').src = src;
    $('#lightbox').hidden = false;
    document.body.classList.add('locked');
  }

  function closeLightbox() {
    $('#lightbox').hidden = true;
    if ($('#sheet').hidden) document.body.classList.remove('locked');
  }

  function openQr() {
    const url = location.origin + location.pathname;
    const img = $('#qrImg');
    // 静态托管没有 /api/qr.png，用打包进来的二维码库在浏览器里现画
    if (CFG.static && window.QRCode && window.QRCode.toDataURL) {
      window.QRCode.toDataURL(url, { width: 720, margin: 1, color: { dark: '#0d2b20', light: '#ffffff' } })
        .then((d) => { img.src = d; })
        .catch(() => {});
    } else {
      img.src = '/api/qr.png?text=' + encodeURIComponent(url) + '&t=' + Date.now();
    }
    $('#qrUrl').textContent = url;
    $('#qrHint').textContent = t(state.data.ui.scanHint);
    $('#qrModal').hidden = false;
  }

  /* ------------------------------ 滚动效果 ------------------------------ */
  let revealObserver = null;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    $$('.reveal:not(.in)').forEach((el) => revealObserver.observe(el));
  }

  function bindTopbar() {
    const bar = $('.topbar');
    const onScroll = () => bar.classList.toggle('solid', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ------------------------------ AI 问答（闪闪） ------------------------------
   * 后端 /api/chat 代理 DeepSeek，Key 不进浏览器；提示词把话题锁在校园。
   */
  const ai = { open: false, busy: false, history: [], greeted: false };

  function aiGet(key, fb) {
    const box = state.data && state.data.ui && state.data.ui.ai;
    if (!box || box[key] == null) return fb || '';
    const v = box[key];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v;
    return v[state.lang] || v.zh || Object.values(v)[0] || fb || '';
  }

  function aiScroll() {
    const log = $('#aiLog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function aiAppend(el) {
    const log = $('#aiLog');
    const sugs = $('#aiSugs');
    if (sugs && sugs.parentNode === log) log.insertBefore(el, sugs);
    else log.appendChild(el);
  }

  function aiBullet(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg' + (role === 'user' ? ' me' : '');
    if (role !== 'user') {
      const ava = document.createElement('span');
      ava.className = 'ai-msg-ava';
      ava.innerHTML = '<img src="media/img/mascot-mark.webp" alt="" aria-hidden="true">';
      wrap.appendChild(ava);
    }
    const b = document.createElement('div');
    b.className = 'ai-bubble';
    b.textContent = text;
    wrap.appendChild(b);
    aiAppend(wrap);
    aiScroll();
    return b;
  }

  function aiTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg';
    wrap.innerHTML = '<span class="ai-msg-ava"><img src="media/img/mascot-mark.webp" alt="" aria-hidden="true"></span>' +
      '<div class="ai-bubble ai-typing" aria-label="thinking"><i></i><i></i><i></i></div>';
    aiAppend(wrap);
    aiScroll();
    return wrap;
  }

  function aiRenderSugs(show) {
    const box = $('#aiSugs');
    const list = aiGet('sugs', []);
    if (!show || !Array.isArray(list) || !list.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = list.map((s) => `<button class="ai-sug" type="button">${escapeHtml(s)}</button>`).join('');
    $$('.ai-sug', box).forEach((b) => b.addEventListener('click', () => aiAsk(b.textContent)));
  }

  function aiSyncCopy() {
    $('#aiName').textContent = aiGet('name', '闪闪');
    $('#aiSub').textContent = aiGet('sub', '');
    $('#aiNote').textContent = aiGet('note', '');
    $('#aiText').placeholder = aiGet('ph', '');
    $('#aiFabTip').textContent = aiGet('fab', '');
    $('#aiFab').setAttribute('aria-label', aiGet('fab', 'AI'));

    // 还没聊过 → 欢迎语跟着语言走
    if (!ai.history.length) {
      const first = $('#aiLog .ai-msg .ai-bubble');
      if (first) first.textContent = aiGet('hello', '');
    }
  }

  function aiOpenPanel(force) {
    const panel = $('#aiPanel');
    const fab = $('#aiFab');
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    ai.open = open;
    fab.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    fab.classList.remove('is-nudge', 'is-hint');
    document.body.classList.toggle('ai-open', open);

    if (!open) return;
    aiSyncCopy();
    if (!ai.greeted) {
      ai.greeted = true;
      const log = $('#aiLog');
      log.classList.add('is-empty');
      // 空状态的大吉祥物（首页已加载这张图，不会多耗流量）
      const hero = document.createElement('div');
      hero.className = 'ai-empty-hero';
      hero.innerHTML = '<img src="media/img/mascot.webp" alt="" aria-hidden="true">';
      log.insertBefore(hero, log.firstChild);
      aiBullet('assistant', aiGet('hello', ''));
      aiRenderSugs(true);
    }
    // 线上版还没接 AI 代理：直接说明，别让访客发了才看到报错
    if (CFG.static && !CFG.chatUrl) {
      const ta = $('#aiText');
      ta.disabled = true;
      ta.placeholder = aiGet('note', '') || 'AI 暂未开启';
      $('#aiSend').disabled = true;
      $('#aiSugs').hidden = true;
      if (!$('.ai-offnote')) {
        const tip = document.createElement('p');
        tip.className = 'ai-offnote';
        tip.textContent = aiGet('offline', '') || '线上版 AI 正在接通中，先用导览逛逛吧～';
        $('#aiLog').appendChild(tip);
      }
    }
    setTimeout(() => { try { $('#aiText').focus({ preventScroll: true }); } catch (e) {} }, 140);
  }

  async function aiAsk(raw) {
    const text = String(raw || '').trim();
    if (!text || ai.busy) return;

    // 静态托管但没配 AI 代理：不发请求，直接给一句提示
    if (CFG.static && !CFG.chatUrl) {
      aiBullet('user', text);
      const m = document.createElement('div');
      m.className = 'ai-msg err';
      m.innerHTML = '<span class="ai-msg-ava"><img src="media/img/mascot-mark.webp" alt="" aria-hidden="true"></span>' +
        `<div class="ai-bubble">${escapeHtml(aiGet('err', ''))}</div>`;
      aiAppend(m);
      aiScroll();
      $('#aiText').value = '';
      return;
    }

    const ta = $('#aiText');
    ta.value = '';
    ta.style.height = 'auto';
    $('#aiSend').disabled = true;
    aiRenderSugs(false);
    $('#aiLog').classList.remove('is-empty');

    aiBullet('user', text);
    ai.history.push({ role: 'user', content: text });
    if (ai.history.length > 12) ai.history = ai.history.slice(-12);

    ai.busy = true;
    const typing = aiTyping();
    let bubble = null;
    let acc = '';

    try {
      const res = await fetch(CFG.chatUrl || '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: state.lang, messages: ai.history })
      });

      if (!res.ok) {
        typing.remove();
        const map = { 429: aiGet('rate', ''), 503: aiGet('err', ''), 502: aiGet('err', ''), 400: aiGet('err', ''), 405: aiGet('err', '') };
        const m = document.createElement('div');
        m.className = 'ai-msg err';
        m.innerHTML = '<span class="ai-msg-ava"><img src="media/img/mascot-mark.webp" alt="" aria-hidden="true"></span>' +
          `<div class="ai-bubble">${escapeHtml(map[res.status] || aiGet('err', ''))}</div>`;
        aiAppend(m);
        ai.history.pop();
        aiScroll();
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let j;
          try { j = JSON.parse(payload); } catch (e) { continue; }
          const piece = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (!piece) continue;
          if (!bubble) {
            typing.remove();
            bubble = aiBullet('assistant', '');
            bubble.classList.add('streaming');
          }
          acc += piece;
          bubble.textContent = acc;
          aiScroll();
        }
      }

      if (bubble) {
        bubble.classList.remove('streaming');
      } else {
        typing.remove();
      }

      if (acc.trim()) {
        ai.history.push({ role: 'assistant', content: acc.trim() });
      } else {
        const m = document.createElement('div');
        m.className = 'ai-msg err';
        m.innerHTML = '<span class="ai-msg-ava"><img src="media/img/mascot-mark.webp" alt="" aria-hidden="true"></span>' +
          `<div class="ai-bubble">${escapeHtml(aiGet('err', ''))}</div>`;
        aiAppend(m);
        ai.history.pop();
      }
      aiScroll();
    } catch (e) {
      try { typing.remove(); } catch (e2) {}
      const m = document.createElement('div');
      m.className = 'ai-msg err';
      m.innerHTML = '<span class="ai-msg-ava"><img src="media/img/mascot-mark.webp" alt="" aria-hidden="true"></span>' +
        `<div class="ai-bubble">${escapeHtml(aiGet('err', ''))}</div>`;
      aiAppend(m);
      ai.history.pop();
      aiScroll();
    } finally {
      ai.busy = false;
      $('#aiSend').disabled = false;
    }
  }

  function bindAI() {
    const fab = $('#aiFab');
    if (!fab || !$('#aiPanel')) return;

    fab.addEventListener('click', () => aiOpenPanel());
    $('#aiClose').addEventListener('click', () => aiOpenPanel(false));

    $('#aiForm').addEventListener('submit', (e) => {
      e.preventDefault();
      aiAsk($('#aiText').value);
    });

    const ta = $('#aiText');
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 108) + 'px';
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        aiAsk(ta.value);
      }
    });

    // 快捷键：/ 或 Ctrl(⌘)+K 唤起
    document.addEventListener('keydown', (e) => {
      const el = e.target;
      const tag = (el && el.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || (el && el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        aiOpenPanel(true);
        return;
      }
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        aiOpenPanel(true);
      }
    });

    // 手机端：点空白处收起抽屉
    document.addEventListener('click', (e) => {
      if (!ai.open) return;
      if (e.target.closest('#aiPanel') || e.target.closest('#aiFab')) return;
      if (window.innerWidth <= 620) aiOpenPanel(false);
    });

    // 手机弹出键盘时，把抽屉压到可视高度以内，别被键盘挡住输入框
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const fit = () => {
        const panel = $('#aiPanel');
        if (!panel || panel.hidden || window.innerWidth > 620) { panel && (panel.style.maxHeight = ''); return; }
        panel.style.maxHeight = Math.round(vv.height * 0.94) + 'px';
        aiScroll();
      };
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
    }

    // 进页面 9 秒后轻轻跳一下 + 冒个提示，告诉游客这里能问 AI
    if (!sessionStorage.getItem('gm.aiNudged')) {
      setTimeout(() => {
        if (!ai.open) {
          fab.classList.add('is-nudge', 'is-hint');
          setTimeout(() => fab.classList.remove('is-hint'), 5200);
        }
        sessionStorage.setItem('gm.aiNudged', '1');
      }, 9000);
    }
  }

  /* ------------------------------ 事件绑定 ------------------------------ */
  function bind() {
    $('#langBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLangMenu();
    });
    $('#langMenu').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lang]');
      if (!b) return;
      setLang(b.dataset.lang);
      toggleLangMenu(false);
    });
    document.addEventListener('click', (e) => {
      if (!$('#langMenu').hidden && !e.target.closest('#langWrap')) toggleLangMenu(false);
    });

    $('#sheetClose').addEventListener('click', () => { location.hash = '#choose'; });
    $('#backBtn').addEventListener('click', () => { location.hash = '#choose'; });
    $('#prevBtn').addEventListener('click', () => { if (state.idx > 0) navigate(state.idx - 1); });
    $('#nextBtn').addEventListener('click', () => {
      if (state.idx >= 0 && state.idx < state.data.communities.length - 1) navigate(state.idx + 1);
    });

    // 详情页内的按钮（事件委托）
    $('#sheet').addEventListener('click', (e) => {
      const c = state.data.communities[state.idx];
      if (!c) return;
      const local = c[state.lang] || c.zh;
      if (e.target.closest('[data-speak]')) {
        const inRow = e.target.closest('.au-row');
        speak(local.name + '。' + local.paras.join(' '), inRow ? 'zh' : state.lang);
      } else if (e.target.closest('[data-video]')) {
        playVideo(c.video, local.name);
      } else if (e.target.closest('[data-audio-toggle]')) {
        const btn = e.target.closest('[data-audio-toggle]');
        const a = $(`#audioBlock .au-row[data-track="${btn.dataset.audioToggle}"] audio`);
        if (!a) return;
        if (!a.paused) { a.pause(); btn.classList.remove('on'); }
        else { a.play().catch(() => {}); btn.classList.add('on'); }
      }
    });

    $('#gallery').addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img) openLightbox(img.dataset.full || img.src);
    });

    // 影片
    $$('[data-play-intro]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!state.data) return;
        playVideo(state.data.site.intro.video, t(state.data.site.intro.title));
      });
    });
    $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeVideo));
    $$('[data-close-lightbox]').forEach((b) => b.addEventListener('click', closeLightbox));
    $$('[data-close-qr]').forEach((b) => b.addEventListener('click', () => { $('#qrModal').hidden = true; }));
    $('#qrBtn').addEventListener('click', openQr);

    // 完整影像
    const fullBtn = $('#introFullBtn');
    if (fullBtn) {
      fullBtn.addEventListener('click', () => {
        if (!state.data) return;
        playVideo(state.data.site.intro.full, t(state.data.site.intro.fullLabel));
      });
    }

    // 首页学生导览音频
    const iaBtn = $('#introAudioBtn');
    const iaEl = $('#introAudioEl');
    if (iaBtn && iaEl) {
      iaBtn.addEventListener('click', () => {
        if (iaEl.paused) { iaEl.play().catch(() => {}); } else { iaEl.pause(); }
      });
      iaEl.addEventListener('play', () => iaBtn.classList.add('playing'));
      iaEl.addEventListener('pause', () => iaBtn.classList.remove('playing'));
      iaEl.addEventListener('ended', () => iaBtn.classList.remove('playing'));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (ai.open) return aiOpenPanel(false);
      if (!$('#langMenu').hidden) return toggleLangMenu(false);
      if (!$('#qrModal').hidden) return ($('#qrModal').hidden = true);
      if (!$('#lightbox').hidden) return closeLightbox();
      if (!$('#videoModal').hidden) return closeVideo();
      if (!$('#sheet').hidden) return (location.hash = '#choose');
    });

    window.addEventListener('hashchange', syncFromHash);
    bindAI();
  }

  /* ------------------------------ 启动 ------------------------------ */
  async function boot() {
    state.lang = detectLang();
    document.documentElement.lang = HTML_LANG[state.lang] || state.lang;
    document.documentElement.dir = isRTL(state.lang) ? 'rtl' : 'ltr';
    buildLangMenu();
    bind();
    bindTopbar();

    try {
      state.data = await loadContent(state.lang);
    } catch (err) {
      try {
        const res = await fetch(contentUrl('zh'), { cache: 'no-cache' });
        state.data = await res.json();
      } catch (e2) {
        $('#grid').innerHTML = '<p style="color:#b1493f">内容加载失败，请刷新页面 / Failed to load / 読み込みに失敗しました</p>';
        return;
      }
    }

    // 语言清单以 content.json 的 meta.languages 为准（以后加语言只改这里）
    const meta = state.data.meta && state.data.meta.languages;
    if (Array.isArray(meta) && meta.length) {
      LANG_META = meta;
      LANGS = meta.map((l) => l.code);
      if (!LANGS.includes(state.lang)) state.lang = 'zh';
      document.documentElement.dir = isRTL(state.lang) ? 'rtl' : 'ltr';
      buildLangMenu();
    }

    renderAll();
    syncFromHash();
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  boot();
})();
