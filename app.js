(() => {
  'use strict';
  const telegram = window.Telegram?.WebApp;
  telegram?.ready(); telegram?.expand();
  try { telegram?.setHeaderColor?.('#050605'); telegram?.setBackgroundColor?.('#050605'); } catch (_) { /* старые версии Telegram */ }
  const BASE_KEY = 'tracker-artista-v1';
  const telegramUserId = telegram?.initDataUnsafe?.user?.id;
  const KEY = telegramUserId ? `${BASE_KEY}:telegram:${telegramUserId}` : BASE_KEY;
  const growthTypes = ['Экспертный контент', 'Студийный бэкстейдж', 'Прямой эфир из студии', 'Разбор собственного трека', 'Личность артиста и творческий путь'];
  const promoTypes = ['Музыкальные блогеры и паблики', 'Тематические сообщества', 'Таргетированная реклама', 'Коллаборации', 'Питчинг и плейлисты'];
  const today = () => new Date().toISOString().slice(0, 10);
  const monthNow = () => new Date().toISOString().slice(0, 7);
  const makeCycle = () => ({ id: Date.now(), title: '', date: '', notes: '', startedAt: today(), days: [], growth: [], promo: [] });
  let state;
  let savedState = localStorage.getItem(KEY);
  if (!savedState && telegramUserId) {
    savedState = localStorage.getItem(BASE_KEY);
    if (savedState) { localStorage.setItem(KEY, savedState); localStorage.removeItem(BASE_KEY); }
  }
  try { state = JSON.parse(savedState); } catch (_) { state = null; }
  if (!state || !state.current) state = { current: makeCycle(), archive: [], reports: [] };
  state.archive ||= []; state.reports ||= [];
  state.profile ||= { alias: '' };
  if (state.theme === 'ice') state.theme = 'electric'; else if (state.theme === 'violet') state.theme = 'sky';
  if (!['lemon', 'electric', 'sky'].includes(state.theme)) state.theme = 'lemon';
  state.current.refLinks ||= [];
  state.archive.forEach(cycle => { cycle.refLinks ||= []; });
  state.quarterViewed ||= [];
  state.pendingFinish ||= state.pendingRelease ? { month: state.pendingRelease.month, cycleId: state.pendingRelease.cycleId } : null;
  delete state.pendingRelease;
  const $ = id => document.getElementById(id);
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const toast = message => { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2100); };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderAvatar() {
    const image = $('avatar-image'), fallback = $('avatar-fallback'), hasAvatar = Boolean(state.avatarData);
    image.hidden = !hasAvatar; fallback.hidden = hasAvatar;
    if (hasAvatar) image.src = state.avatarData; else image.removeAttribute('src');
    const profileImage = $('profile-avatar-image'), profileFallback = $('profile-avatar-fallback');
    profileImage.hidden = !hasAvatar; profileFallback.hidden = hasAvatar;
    if (hasAvatar) profileImage.src = state.avatarData; else profileImage.removeAttribute('src');
    $('avatar-upload-button').setAttribute('aria-label', hasAvatar ? 'Изменить аватарку' : 'Загрузить аватарку');
  }
  $('avatar-upload-button').addEventListener('click', () => $('avatar-file').click());
  $('profile-avatar-button').addEventListener('click', () => $('avatar-file').click());
  $('avatar-file').addEventListener('change', () => {
    const picker = $('avatar-file'), file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Выбери изображение JPG, PNG или WebP'); return; }
    if (file.size > 12 * 1024 * 1024) { toast('Изображение должно быть меньше 12 МБ'); return; }
    const reader = new FileReader();
    reader.onerror = () => toast('Не удалось открыть изображение');
    reader.onload = () => {
      const picture = new Image();
      picture.onerror = () => toast('Не удалось открыть изображение');
      picture.onload = () => {
        const scale = Math.min(1, 512 / Math.max(picture.width, picture.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(picture.width * scale)); canvas.height = Math.max(1, Math.round(picture.height * scale));
        const context = canvas.getContext('2d'); context.fillStyle = '#10120d'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height);
        const previous = state.avatarData;
        try { state.avatarData = canvas.toDataURL('image/jpeg', .84); save(); renderAvatar(); toast('Аватарка сохранена на этом устройстве'); }
        catch (_) { state.avatarData = previous; toast('Не удалось сохранить аватарку'); }
      };
      picture.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  const fillSelect = (id, list) => { $(id).innerHTML = list.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join(''); };
  fillSelect('growth-type', growthTypes); fillSelect('promo-type', promoTypes);
  function renderProfile() {
    $('profile-alias').value = state.profile.alias || '';
    $('profile-name-preview').textContent = state.profile.alias || 'Новый артист';
    document.body.dataset.theme = state.theme;
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme)));
  }
  $('profile-alias').addEventListener('input', () => { $('profile-name-preview').textContent = $('profile-alias').value.trim() || 'Новый артист'; });
  $('save-profile').addEventListener('click', () => {
    state.profile = { ...state.profile, alias: $('profile-alias').value.trim() }; save(); renderProfile(); toast('Профиль сохранён');
  });
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
    state.theme = button.dataset.themeChoice; document.body.dataset.theme = state.theme;
    document.querySelectorAll('[data-theme-choice]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    save(); toast(`Тема «${button.querySelector('b').textContent}» включена`);
  }));

  function renderCycle() {
    const c = state.current;
    $('track-label').textContent = `ТРЕК ${String(state.archive.length + 1).padStart(2, '0')}`;
    $('track-title').value = c.title || ''; $('release-date').value = c.date || ''; $('release-notes').value = c.notes || '';
    $('current-track-heading').textContent = c.title || 'Держи фокус.';
    $('dashboard-track-title').textContent = c.title || '';
    $('dashboard-release-date').textContent = c.date ? `Дата релиза · ${formatDate(c.date)}` : '';
    const setupComplete = Boolean(c.title && c.date);
    $('welcome-slide').hidden = setupComplete;
    $('dashboard-slide').hidden = !setupComplete;
    const count = Math.min(30, c.days.length);
    $('snippet-count').textContent = `${count} / 30`; $('snippet-percent').textContent = `${Math.round(count / 30 * 100)}%`; $('snippet-progress').style.width = `${count / 30 * 100}%`;
    $('days-grid').innerHTML = Array.from({ length: 30 }, (_, i) => `<button class="day-toggle ${c.days.includes(i + 1) ? 'done' : ''}" data-day="${i + 1}" aria-label="День ${i + 1}${c.days.includes(i + 1) ? ', выполнен' : ''}" aria-pressed="${c.days.includes(i + 1)}">${String(i + 1).padStart(2, '0')}</button>`).join('');
    $('undo-snippet').disabled = !c.days.length;
    renderQuest('growth', c.growth, 5); renderQuest('promo', c.promo, 3);
  }
  function renderQuest(type, items, goal) {
    const pct = Math.min(100, items.length / goal * 100);
    $(`${type}-count`).textContent = `${items.length} / ${goal}`; $(`${type}-progress`).style.width = `${pct}%`;
    $(`undo-${type}`).disabled = !items.length;
    $(`${type}-list`).innerHTML = items.slice(-4).map((item, i) => `<span class="activity-chip" title="Выполнение ${items.length - Math.min(4, items.length) + i + 1}">${esc(item.label)}</span>`).join('');
  }
  function totalMusicPlays(values = {}) {
    const keys = ['yandexPlays', 'vkPlays', 'spotifyPlays', 'applePlays'];
    const available = keys.filter(key => values[key] !== undefined);
    if (available.length) return available.reduce((sum, key) => sum + (Number(values[key]) || 0), 0);
    return values.musicPlays === undefined ? null : Number(values.musicPlays) || 0;
  }
  function sumAvailable(values, keys) {
    const available = keys.filter(key => values[key] !== undefined);
    return available.length ? num(available.reduce((sum, key) => sum + (Number(values[key]) || 0), 0)) : '—';
  }
  function renderReports() {
    const sorted = [...state.reports].sort((a, b) => b.month.localeCompare(a.month));
    $('report-count').textContent = `${sorted.length} отчёт${sorted.length === 1 ? '' : sorted.length < 5 ? 'а' : 'ов'}`;
    $('report-list').innerHTML = sorted.length ? sorted.map(r => `<article class="report-row"><div><h3>${esc(formatMonth(r.month))}</h3><p>Instagram · TikTok · Яндекс Музыка · VK · Spotify · Apple Music</p></div><div class="report-stats"><div><b>${sumAvailable(r.values, ['igViews', 'ttViews'])}</b><small>просмотры</small></div><div><b>${totalMusicPlays(r.values) === null ? '—' : num(totalMusicPlays(r.values))}</b><small>прослушивания</small></div></div></article>`).join('') : '<div class="empty-state">Сохрани первый месячный отчёт — он появится здесь.</div>';
    const q = sorted.slice(0, 3).reverse();
    $('quarter-content').innerHTML = q.length < 3 ? `<div class="empty-state" style="grid-column:1/-1">Нужно ещё ${3 - q.length} ${q.length === 2 ? 'отчёт' : q.length === 1 ? 'отчёта' : 'отчёта'}, чтобы сравнить квартал.</div>` : q.map(r => `<div class="quarter-month"><b>${esc(shortMonth(r.month))}</b><span>${totalMusicPlays(r.values) === null ? '—' : num(totalMusicPlays(r.values))}</span><small>прослушиваний</small></div>`).join('');
    renderPlatformTrends(q);
  }
  function latestQuarter() { return [...state.reports].sort((a, b) => a.month.localeCompare(b.month)).slice(-3); }
  function showQuarterReview() {
    const reports = latestQuarter();
    if (reports.length < 3) return false;
    const key = reports.map(report => report.month).join('|');
    if (state.quarterViewed.includes(key)) return false;
    state.quarterViewed.push(key); save();
    $('quarter-dialog-period').textContent = `${formatMonth(reports[0].month)} — ${formatMonth(reports[2].month)}`;
    $('quarter-dialog-months').innerHTML = $('quarter-content').innerHTML;
    $('quarter-dialog-charts').innerHTML = $('trend-content').innerHTML;
    $('quarter-dialog').showModal();
    return true;
  }
  function renderPlatformTrends(reports) {
    $('trend-period').textContent = `${reports.length} ${reports.length === 1 ? 'месяц' : reports.length === 2 ? 'месяца' : 'месяца'}`;
    if (reports.length < 2) {
      $('trend-content').innerHTML = `<div class="empty-state">Сохрани ещё ${2 - reports.length} ${reports.length ? 'отчёт' : 'отчёта'}, чтобы увидеть график и прирост.</div>`;
      return;
    }
    const platforms = [
      { name: 'Instagram', metrics: [{ label: 'Просмотры', key: 'igViews', color: 'lemon' }, { label: 'Подписчики', key: 'igFollowers', color: 'silver' }] },
      { name: 'TikTok', metrics: [{ label: 'Просмотры', key: 'ttViews', color: 'lemon' }, { label: 'Подписчики', key: 'ttFollowers', color: 'silver' }] },
      { name: 'Яндекс Музыка', metrics: [{ label: 'Прослушивания', key: 'yandexPlays', color: 'lemon' }, { label: 'Уникальные слушатели', key: 'yandexListeners', color: 'silver' }] },
      { name: 'VK Музыка', metrics: [{ label: 'Прослушивания', key: 'vkPlays', color: 'lemon' }, { label: 'Уникальные слушатели', key: 'vkListeners', color: 'silver' }] },
      { name: 'Spotify', metrics: [{ label: 'Прослушивания', key: 'spotifyPlays', color: 'lemon' }, { label: 'Уникальные слушатели', key: 'spotifyListeners', color: 'silver' }] },
      { name: 'Apple Music', metrics: [{ label: 'Прослушивания', key: 'applePlays', color: 'lemon' }, { label: 'Уникальные слушатели', key: 'appleListeners', color: 'silver' }] }
    ];
    $('trend-content').innerHTML = `<div class="trend-grid">${platforms.map(platform => `<article class="trend-card platform-trend-card"><h3 class="platform-trend-title">${esc(platform.name)}</h3><div class="platform-metrics">${platform.metrics.map(metric => trendCard(metric, reports)).join('')}</div></article>`).join('')}</div><div class="trend-legend"><span><i class="legend-dot lemon"></i>Просмотры и прослушивания</span><span><i class="legend-dot silver"></i>Прирост аудитории</span></div><p class="trend-note">Изменение считается от первого к последнему месяцу на графике. Если в первом месяце было 0, показываем абсолютное изменение.</p>`;
  }
  function trendCard(metric, reports) {
    const values = reports.map(r => r.values?.[metric.key] === undefined ? null : Number(r.values[metric.key]) || 0);
    const validValues = values.filter(v => v !== null);
    const low = validValues.length ? Math.min(...validValues) : 0, high = validValues.length ? Math.max(...validValues) : 0, spread = high - low || 1;
    const points = values.map((v, i) => v === null ? null : ({ x: 16 + i * (108 / (values.length - 1)), y: 43 - ((v - low) / spread) * 31 }));
    const path = points.slice(1).map((p, i) => p && points[i] ? `M${points[i].x.toFixed(1)},${points[i].y.toFixed(1)} L${p.x.toFixed(1)},${p.y.toFixed(1)}` : '').filter(Boolean).join(' ');
    const firstIndex = values.findIndex(v => v !== null), lastIndex = values.length - 1 - [...values].reverse().findIndex(v => v !== null);
    const first = firstIndex >= 0 ? values[firstIndex] : null, last = lastIndex >= 0 ? values[lastIndex] : null;
    const delta = first !== null && last !== null && firstIndex !== lastIndex ? last - first : null;
    const rawPercent = first > 0 && delta !== null ? Math.round(delta / first * 100) : 0;
    const growth = delta === null ? 'Новый учёт' : first > 0 ? `${rawPercent > 0 ? '+' : ''}${rawPercent > 999999 ? new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(rawPercent) : num(rawPercent)}%` : (delta > 0 ? 'Новый показатель' : '0%');
    const deltaText = delta === null ? '—' : `${delta > 0 ? '+' : ''}${num(delta)}`;
    const labels = reports.map(r => `<span><small>${esc(shortMonth(r.month))}</small><b>${r.values?.[metric.key] === undefined ? '—' : num(r.values[metric.key])}</b></span>`).join('');
    return `<section class="platform-metric"><div class="trend-card-heading"><div><span class="trend-platform ${metric.color}"></span><b>${esc(metric.label)}</b></div><span class="trend-growth ${metric.color} ${delta !== null && delta < 0 ? 'negative' : ''}">${esc(growth)}</span></div><svg class="trend-chart ${metric.color}" viewBox="0 0 140 54" role="img" aria-label="${esc(metric.label)}: ${values.map((v, i) => `${formatMonth(reports[i].month)} — ${v === null ? 'нет данных' : num(v)}`).join('; ')}"><path class="chart-guide" d="M8 44H132 M8 27H132 M8 10H132"/><path class="chart-line" pathLength="1" d="${path}"/>${points.filter(Boolean).map(p => `<circle class="chart-point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3"/>`).join('')}</svg><div class="trend-values" style="grid-template-columns:repeat(${reports.length},minmax(0,1fr))">${labels}</div><div class="trend-delta ${metric.color}"><span>${delta === null ? 'Для прироста нужны 2 отчёта' : 'Изменение за период'}</span><b>${esc(deltaText)}</b></div></section>`;
  }
  function renderArchive() {
    const rows = state.archive;
    $('archive-list').innerHTML = rows.length ? [...rows].reverse().map((c, reverseIndex) => { const idx = rows.length - 1 - reverseIndex; return `<article class="archive-row"><span class="archive-mark">♫</span><div class="archive-main"><h3>${esc(c.title || 'Без названия')}</h3><p>${c.date ? `Релиз: ${esc(formatDate(c.date))}` : 'Дата релиза не указана'} · трек начат ${esc(formatDate(c.startedAt))}</p></div><div class="archive-progress"><b>${c.days.length}/30</b><small>сниппетов · ${c.growth.length} контент · ${c.promo.length} промо</small></div><button class="button button-subtle archive-notes" data-note-index="${idx}" type="button">Заметки</button></article>`; }).join('') : '<div class="empty-state">Здесь появятся прошлые треки, когда ты начнёшь новый релиз.</div>';
  }
  function notesTarget() {
    const key = state.notesTarget || $('notes-track-select').value || 'current';
    if (key === 'current') return state.current;
    const idx = Number(key.slice('archive:'.length));
    return Number.isInteger(idx) ? state.archive[idx] : state.current;
  }
  function validHttpUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } }
  function renderNoteLinks(cycle) {
    const refs = cycle.refLinks || [];
    $('notes-links').innerHTML = refs.length ? refs.map((ref, i) => { const url = validHttpUrl(ref.url); return `<div class="note-link-row" data-ref-index="${i}"><div class="note-link-fields"><label class="field">Название<input class="note-ref-title" value="${esc(ref.title || '')}" placeholder="Например, настроение клипа" maxlength="100"></label><label class="field">Ссылка<input class="note-ref-url" type="url" value="${esc(ref.url || '')}" placeholder="https://…" inputmode="url"></label></div>${url ? `<a class="note-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку">↗</a>` : ''}<button class="note-remove-link" type="button" aria-label="Удалить ссылку">×</button></div>`; }).join('') : '<div class="notes-empty">Пока нет ссылок. Добавь референс, чтобы быстро вернуться к нему.</div>';
  }
  function renderNotes() {
    const selector = $('notes-track-select');
    const selected = state.notesTarget || selector.value || 'current';
    selector.innerHTML = `<option value="current">${esc(state.current.title || 'Новый трек')} · текущий</option>` + state.archive.map((c, i) => `<option value="archive:${i}">${esc(c.title || 'Без названия')} · архив</option>`).join('');
    selector.value = [...selector.options].some(option => option.value === selected) ? selected : 'current';
    state.notesTarget = selector.value;
    const cycle = notesTarget();
    $('notes-content').value = cycle.notes || '';
    $('notes-track-caption').textContent = cycle.date ? `Дата релиза · ${formatDate(cycle.date)}${selector.value === 'current' ? ' · текущий трек' : ' · архивный трек'}` : (selector.value === 'current' ? 'Текущий трек · заметки можно собирать ещё до даты релиза' : 'Архивный трек');
    renderNoteLinks(cycle);
  }
  function readNotesEditor(cycle) {
    cycle.notes = $('notes-content').value.trim();
    cycle.refLinks = [...$('notes-links').querySelectorAll('.note-link-row')].map(row => ({ title: row.querySelector('.note-ref-title').value.trim(), url: row.querySelector('.note-ref-url').value.trim() })).filter(ref => ref.title || ref.url);
  }
  function render() { renderCycle(); renderReports(); renderArchive(); renderNotes(); }
  function showCycleReview(c, report) {
    const completed = c.days.length >= 30 && c.growth.length >= 5 && c.promo.length >= 3;
    $('review-dialog').classList.toggle('review-complete', completed);
    $('review-eyebrow').textContent = completed ? 'ПЛАН ВЫПОЛНЕН' : 'ИТОГИ 30-ДНЕВНОГО ТРЕКА';
    $('review-title').textContent = completed ? 'Ты сделал это!' : 'Трек завершён';
    $('review-message').textContent = completed
      ? 'Ты выдержал свой ритм и выполнил весь план. Каждый шаг приблизил твою музыку к слушателям.'
      : 'План выполнен не полностью — но сделанная работа уже имеет значение. Посмотри, что удалось, и выбери следующий шаг без самокритики.';
    $('review-slogan').textContent = completed ? 'Твой ритм — твоя сила. Продолжай звучать.' : 'Один следующий шаг — уже новое движение.';
    $('review-mark').textContent = completed ? '✦' : '↗';
    $('review-summary').innerHTML = `<div><span>Сниппеты</span><b>${Math.min(c.days.length, 30)} / 30</b></div><div><span>Рост и контент</span><b>${c.growth.length} / 5</b></div><div><span>Продвижение</span><b>${c.promo.length} / 3</b></div>`;
    const values = report?.values || {};
    $('review-month-label').textContent = `СТАТИСТИКА ЗА ${formatMonth(report?.month || c.date?.slice(0, 7) || monthNow()).toLocaleUpperCase('ru-RU')}`;
    const rows = [
      ['Instagram', `${metricStat(values.igViews, 'просмотров')} · ${metricStat(values.igFollowers, 'подписчиков')}`],
      ['TikTok', `${metricStat(values.ttViews, 'просмотров')} · ${metricStat(values.ttFollowers, 'подписчиков')}`],
      ['Яндекс Музыка', musicStat(values, 'yandexPlays', 'yandexListeners')],
      ['VK Музыка', musicStat(values, 'vkPlays', 'vkListeners')],
      ['Spotify', musicStat(values, 'spotifyPlays', 'spotifyListeners')],
      ['Apple Music', musicStat(values, 'applePlays', 'appleListeners')]
    ];
    if (values.musicPlays !== undefined && values.yandexPlays === undefined) rows.push(['Старый общий отчёт площадок', `${num(values.musicPlays)} прослушиваний · ${num(values.musicListeners)} слушателей`]);
    $('review-month-summary').innerHTML = rows.map(([name, stats]) => `<div><span>${esc(name)}</span><b>${stats}</b></div>`).join('');
    $('review-dialog').showModal();
  }
  function metricStat(value, label) { return value === undefined ? `нет данных ${label}` : `${num(value)} ${label}`; }
  function musicStat(values, playsKey, listenersKey) { return values[playsKey] === undefined && values[listenersKey] === undefined ? 'нет данных' : `${metricStat(values[playsKey], 'прослушиваний')} · ${metricStat(values[listenersKey], 'слушателей')}`; }
  $('save-release').addEventListener('click', () => {
    const title = $('track-title').value.trim();
    const date = $('release-date').value;
    if (!title) { toast('Добавь название трека'); $('track-title').focus(); return; }
    if (!date) { toast('Укажи дату релиза'); $('release-date').focus(); return; }
    Object.assign(state.current, { title, date, notes: $('release-notes').value.trim() });
    save(); $('current-track-heading').textContent = title; $('dashboard-track-title').textContent = title; $('dashboard-release-date').textContent = `Дата релиза · ${formatDate(date)}`; renderNotes();
    transitionHomeSlide('dashboard'); toast('Изменения сохранены · прогресс на месте');
  });
  $('edit-release').addEventListener('click', () => transitionHomeSlide('welcome'));
  $('cancel-new').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-new').addEventListener('click', () => { state.archive.push({ ...state.current, archivedAt: today() }); state.current = makeCycle(); state.notesTarget = 'current'; state.pendingFinish = null; save(); $('confirm-dialog').close(); render(); showView('home'); toast('Новый трек начат'); });
  $('review-close').addEventListener('click', () => { $('review-dialog').close(); showQuarterReview(); });
  $('review-new').addEventListener('click', () => { $('review-dialog').close(); if (showQuarterReview()) return; showView('home', () => $('confirm-dialog').showModal()); });
  $('quarter-close').addEventListener('click', () => $('quarter-dialog').close());
  $('quarter-new').addEventListener('click', () => { $('quarter-dialog').close(); showView('home', () => $('confirm-dialog').showModal()); });
  $('finish-plan').addEventListener('click', finishPlan);
    $('days-grid').addEventListener('click', e => { const button = e.target.closest('[data-day]'); if (!button) return; const day = Number(button.dataset.day); const marking = !state.current.days.includes(day); if (!marking) state.current.days = state.current.days.filter(d => d !== day); else state.current.days.push(day); state.current.days.sort((a, b) => a - b); save(); renderCycle(); if (marking) requestAnimationFrame(() => { const marked = $('days-grid').querySelector(`[data-day="${day}"]`); marked?.classList.add('motion-pop'); }); });
  $('undo-snippet').addEventListener('click', () => { state.current.days.pop(); save(); renderCycle(); toast('Последняя отметка снята'); });
  $('add-growth').addEventListener('click', () => addQuest('growth', growthTypes));
  $('add-promo').addEventListener('click', () => addQuest('promo', promoTypes));
  function addQuest(type, list) { state.current[type].push({ label: list[Number($(`${type}-type`).value)], date: today() }); save(); renderCycle(); requestAnimationFrame(() => $(`${type}-list`).lastElementChild?.classList.add('motion-pop')); toast('Выполнение добавлено'); }
  $('undo-growth').addEventListener('click', () => undoQuest('growth'));
  $('undo-promo').addEventListener('click', () => undoQuest('promo'));
  function undoQuest(type) { state.current[type].pop(); save(); renderCycle(); toast('Последнее выполнение отменено'); }

  $('notes-track-select').addEventListener('change', () => { readNotesEditor(notesTarget()); save(); state.notesTarget = $('notes-track-select').value; renderNotes(); });
  $('add-note-link').addEventListener('click', () => { const cycle = notesTarget(); cycle.refLinks ||= []; cycle.refLinks.push({ title: '', url: '' }); renderNoteLinks(cycle); $('notes-links').lastElementChild?.querySelector('.note-ref-title')?.focus(); });
  $('notes-links').addEventListener('click', e => { const remove = e.target.closest('.note-remove-link'); if (remove) { const row = remove.closest('[data-ref-index]'); notesTarget().refLinks.splice(Number(row.dataset.refIndex), 1); renderNoteLinks(notesTarget()); return; } });
  $('save-track-notes').addEventListener('click', () => {
    const cycle = notesTarget(); readNotesEditor(cycle);
    const invalid = cycle.refLinks.find(ref => ref.url && !validHttpUrl(ref.url));
    if (invalid) { toast('Ссылка должна начинаться с https:// или http://'); return; }
    save(); renderNoteLinks(cycle); if (cycle === state.current) $('release-notes').value = cycle.notes; toast('Заметки и референсы сохранены');
  });
  $('archive-list').addEventListener('click', e => { const button = e.target.closest('[data-note-index]'); if (!button) return; state.notesTarget = `archive:${button.dataset.noteIndex}`; save(); showView('notes'); });

  const monthInput = $('report-month'); monthInput.value = state.pendingFinish?.month || monthNow();
  monthInput.addEventListener('change', loadReport);
  function readValues() {
    const fields = { igViews: 'ig-views', igFollowers: 'ig-followers', ttViews: 'tt-views', ttFollowers: 'tt-followers', yandexPlays: 'yandex-plays', yandexListeners: 'yandex-listeners', vkPlays: 'vk-plays', vkListeners: 'vk-listeners', spotifyPlays: 'spotify-plays', spotifyListeners: 'spotify-listeners', applePlays: 'apple-plays', appleListeners: 'apple-listeners' };
    return Object.fromEntries(Object.entries(fields).flatMap(([key, id]) => {
      const raw = $(id).value.trim();
      return raw === '' ? [] : [[key, Math.max(0, Number(raw) || 0)]];
    }));
  }
  function loadReport() { const report = state.reports.find(r => r.month === monthInput.value); const values = report?.values || {}; for (const [key, id] of Object.entries({'igViews':'ig-views','igFollowers':'ig-followers','ttViews':'tt-views','ttFollowers':'tt-followers','yandexPlays':'yandex-plays','yandexListeners':'yandex-listeners','vkPlays':'vk-plays','vkListeners':'vk-listeners','spotifyPlays':'spotify-plays','spotifyListeners':'spotify-listeners','applePlays':'apple-plays','appleListeners':'apple-listeners'})) $(id).value = values[key] ?? ''; const isLegacy = report && values.musicPlays !== undefined && !['yandexPlays','vkPlays','spotifyPlays','applePlays'].some(key => values[key] !== undefined); $('legacy-report-note').hidden = !isLegacy; $('report-month-title').textContent = formatMonth(monthInput.value); }
  function finishPlan() {
    const month = state.current.date?.slice(0, 7) || monthNow();
    const report = state.reports.find(item => item.month === month);
    if (report) { showCycleReview(state.current, report); return; }
    state.pendingFinish = { month, cycleId: state.current.id };
    save(); monthInput.value = month; loadReport(); refreshPendingUI(); showView('analytics');
    toast('Сначала заполни аналитику за месяц');
  }
  function refreshPendingUI() { const pending = state.pendingFinish; $('analytics-pending').hidden = !pending; monthInput.disabled = !!pending; $('save-report').textContent = pending ? 'Сохранить заполненное и показать итоги' : 'Сохранить отчёт'; $('skip-report').hidden = !pending; if (pending) $('analytics-pending-copy').textContent = `Заполни доступные показатели за ${formatMonth(pending.month)}. Неизвестные оставь пустыми — они не попадут в отчёт.`; }
  $('save-report').addEventListener('click', () => {
    if (!monthInput.value) { toast('Выбери месяц отчёта'); return; }
    const values = readValues();
    if (!Object.keys(values).length) { toast('Нет заполненных показателей. Можно пропустить аналитику.'); return; }
    const idx = state.reports.findIndex(r => r.month === monthInput.value);
    const previousValues = idx >= 0 ? state.reports[idx].values : {};
    if (previousValues.musicPlays !== undefined && !['yandexPlays', 'vkPlays', 'spotifyPlays', 'applePlays'].some(key => previousValues[key] !== undefined)) {
      values.musicPlays = previousValues.musicPlays;
      if (previousValues.musicListeners !== undefined) values.musicListeners = previousValues.musicListeners;
    }
    const report = { month: monthInput.value, values, updatedAt: new Date().toISOString() };
    if (idx >= 0) state.reports[idx] = report; else state.reports.push(report);
    save(); $('legacy-report-note').hidden = true; renderReports();
    if (state.pendingFinish) { const cycle = state.current; state.pendingFinish = null; save(); refreshPendingUI(); showView('home', () => showCycleReview(cycle, report)); return; }
    if (showQuarterReview()) return;
    toast('Месячный отчёт сохранён');
  });
  $('skip-report').addEventListener('click', () => {
    if (!state.pendingFinish) return;
    const cycle = state.current;
    state.pendingFinish = null; save(); refreshPendingUI();
    showView('home', () => showCycleReview(cycle, null));
    toast('Аналитика пропущена');
  });
  let viewTransitionTimer;
  function showView(name, afterTransition) {
    const next = $(`${name}-view`), current = document.querySelector('.view.active');
    if (name === 'notes') renderNotes();
    if (name === 'profile') renderProfile();
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('selected', b.dataset.view === name));
    if (name === 'home') telegram?.BackButton?.hide(); else telegram?.BackButton?.show();
    if (current === next) { afterTransition?.(); return; }
    clearTimeout(viewTransitionTimer);
    current?.classList.add('view-exit');
    viewTransitionTimer = setTimeout(() => {
      current?.classList.remove('active', 'view-exit');
      next.classList.add('active', 'view-enter');
      next.classList.remove('motion-enter'); void next.offsetWidth; next.classList.add('motion-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('view-enter')));
      setTimeout(() => next.classList.remove('motion-enter'), 1500);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      afterTransition?.();
    }, 180);
  }
  // Telegram's unverified user id only separates local storage buckets; it is never used for authorization.
  telegram?.BackButton?.onClick(() => showView('home'));
  let slideTransitionTimer;
  function transitionHomeSlide(target) {
    const incoming = $(target === 'dashboard' ? 'dashboard-slide' : 'welcome-slide');
    const outgoing = $(target === 'dashboard' ? 'welcome-slide' : 'dashboard-slide');
    if (incoming.hidden === false) return;
    clearTimeout(slideTransitionTimer);
    outgoing.classList.add('slide-exit');
    slideTransitionTimer = setTimeout(() => {
      outgoing.hidden = true; outgoing.classList.remove('slide-exit');
      incoming.hidden = false; incoming.classList.add('slide-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.remove('slide-enter')));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 220);
  }
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('menu-button').addEventListener('click', () => { const current = document.querySelector('.view.active').id; showView(current === 'profile-view' ? 'home' : 'profile'); });
  function num(value) { return new Intl.NumberFormat('ru-RU').format(value || 0); }
  function formatDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
  function formatMonth(value) { if (!value) return 'Этот месяц'; const [year, month] = value.split('-').map(Number); return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); }
  function shortMonth(value) { const [year, month] = value.split('-').map(Number); return new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(new Date(year, month - 1, 1)); }
  document.body.dataset.theme = state.theme; renderAvatar(); render(); renderProfile(); loadReport(); refreshPendingUI();
  if (state.pendingFinish) showView('analytics');
  else showQuarterReview();
})();
