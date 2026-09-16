/* =========================================================
   Мебельная фабрика «Dарина» — script.js
   Зависит от data.js (COMPANY, CATEGORIES, PRODUCTS, FINISHES)
   ========================================================= */

/* ------------------------- Настройки заявки ------------------------- */
const ORDER = {
  /* Заявки уходят через Web3Forms — свой сервер не нужен, работает
     в том числе на GitHub Pages. Куда придёт письмо, определяет ключ:
     он привязан к почте в личном кабинете web3forms.com.
     Ключ можно держать в открытом коде, это не пароль. */
  endpoint: 'https://api.web3forms.com/submit',
  accessKey: 'd84f612f-76a3-4e4c-98fb-501c97a53f12',
  subject: 'Заявка с сайта darinameb.ru'
};

/* ---------------------------- Утилиты ---------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ROOT = document.body.dataset.root || '';
const path = (p) => ROOT + p;

const money = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

const byId = (id) => PRODUCTS.find((p) => p.id === id);
const catById = (id) => CATEGORIES.find((c) => c.id === id);

const plural = (n, forms) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
};

/* Цвет образца по названию отделки (в т.ч. составному «Орех / Дуб Канзас») */
const finishColors = (name) =>
  name
    .split('/')
    .map((part) => FINISHES[part.trim().toLowerCase()] || '#C9C9D2')
    .slice(0, 2);

const swatchStyle = (name) => {
  const [a, b] = finishColors(name);
  return b ? `background:linear-gradient(135deg,${a} 0 50%,${b} 50% 100%)` : `background:${a}`;
};

/* Цена зависит и от размера, и от отделки: в прайсе фабрики орех дороже
   белого на той же кровати. Точные значения лежат в grid («отделка|размер»),
   а базовая цена с надбавкой за размер — запасной вариант для позиций,
   где отделка на цену не влияет. */
const priceOf = (p, sizeIndex = 0, colorIndex = 0) => {
  const exact = p.grid?.[`${colorIndex}|${sizeIndex}`];
  if (typeof exact === 'number') return exact;
  return p.price + (p.sizes?.[sizeIndex]?.add || 0);
};

/* ----------------------- Анимация «летающих» цифр ----------------------- */
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -9 * t));

/* Пользователь мог отключить анимации в системе — уважаем настройку */
const reduceMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function countUp(el, to, { dur = 1100, prefix = '', suffix = '' } = {}) {
  el.dataset.started = '1';
  if (reduceMotion()) {
    el.textContent = prefix + money(to) + suffix;
    return;
  }
  const from = Number(el.dataset.from || 0);
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min((now - t0) / dur, 1);
    const v = from + (to - from) * easeOutExpo(t);
    el.textContent = prefix + money(v) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.dataset.from = to;
  };
  requestAnimationFrame(tick);
}

/* Один наблюдатель на все числа, которые должны «взлететь» при появлении */
const counterObserver = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      countUp(el, Number(el.dataset.count), {
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || '',
        dur: Number(el.dataset.dur || 1100)
      });
      obs.unobserve(el);
    });
  },
  { threshold: .4 }
);

/* Цена — главное число на сайте, поэтому у анимации есть страховка:
   если наблюдатель недоступен или блок так и не попал в зону видимости,
   значение проставляется сразу, без нуля на экране. */
const setNow = (el) => {
  el.dataset.started = '1';
  el.dataset.from = el.dataset.count;
  el.textContent = (el.dataset.prefix || '') + money(Number(el.dataset.count)) + (el.dataset.suffix || '');
};

const watchCounters = (root = document) =>
  $$('[data-count]', root).forEach((el) => {
    if (!('IntersectionObserver' in window)) { setNow(el); return; }
    counterObserver.observe(el);
    setTimeout(() => { if (!el.dataset.started) setNow(el); }, 2000);
  });

/* -------------------------- Раскрытие при скролле -------------------------- */
const revealObserver = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('is-in'), i * 60);
      obs.unobserve(e.target);
    });
  },
  { threshold: .12, rootMargin: '0px 0px -40px' }
);

const watchReveals = (root = document) => $$('.reveal:not(.is-in)', root).forEach((el) => revealObserver.observe(el));

/* ------------------------------ Иконки ------------------------------ */
const ICON = {
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2L21 14.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>',
  truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg>',
  tree: '<svg viewBox="0 0 24 24"><path d="M12 3 6.5 11h3L5 17h14l-4.5-6h3L12 3zM12 17v4"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6l-7-3z"/><path d="m9 12 2 2 4-4"/></svg>'
};

/* ------------------------------ Корзина ------------------------------ */
const CART_KEY = 'darina_cart_v1';

const cartRead = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
};
const cartWrite = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  syncCartUI();
};
const cartCount = () => cartRead().reduce((s, i) => s + i.qty, 0);
const cartTotal = () =>
  cartRead().reduce((s, i) => {
    const p = byId(i.id);
    return p ? s + priceOf(p, i.size, i.color) * i.qty : s;
  }, 0);

/* opts — выбранные варианты основания, матраса, ящика и т. п.
   Позиция с другой комплектацией считается отдельной строкой корзины. */
const sameOpts = (a = [], b = []) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function cartAdd(id, color = 0, size = 0, qty = 1, opts = []) {
  const items = cartRead();
  const found = items.find((i) =>
    i.id === id && i.color === color && i.size === size && sameOpts(i.opts || [], opts));
  if (found) found.qty += qty;
  else items.push({ id, color, size, qty, opts });
  cartWrite(items);
}

/* Человекочитаемый список выбранного — для корзины и для письма */
function chosenOf(p, item) {
  const out = [];
  if (p.colors?.length) out.push(['Отделка', p.colors[item.color] || p.colors[0]]);
  if (p.sizes?.length) out.push([bedLike(p) ? 'Спальное место' : 'Размер', (p.sizes[item.size]?.label || p.sizes[0].label) + ' мм']);
  const d = dimsFor(p, item.size);
  if (d) out.push(['Габариты', d]);
  (p.opts || []).forEach((o, i) => {
    const v = o.v[(item.opts || [])[i] || 0];
    if (v) out.push([o.n, v]);
  });
  return out;
}

function cartSetQty(index, qty) {
  const items = cartRead();
  if (!items[index]) return;
  if (qty <= 0) items.splice(index, 1);
  else items[index].qty = Math.min(qty, 99);
  cartWrite(items);
}

function cartRemove(index) {
  const items = cartRead();
  items.splice(index, 1);
  cartWrite(items);
}

function syncCartUI() {
  const n = cartCount();
  $$('[data-cart-badge]').forEach((b) => {
    b.textContent = n;
    b.classList.toggle('is-on', n > 0);
    if (n > 0) {
      b.classList.remove('is-bump');
      void b.offsetWidth;
      b.classList.add('is-bump');
    }
  });
  const fab = $('#fab');
  if (fab) {
    fab.classList.toggle('is-on', n > 0);
    const cnt = $('[data-fab-count]', fab);
    if (cnt) cnt.textContent = n;
    const sum = $('[data-fab-sum]', fab);
    if (sum) sum.textContent = money(cartTotal()) + ' ₽';
  }
}

/* Цифра, летящая от кнопки к корзине */
function flyToCart(fromEl, text = '+1') {
  if (reduceMotion()) return;
  const target = $('[data-cart-badge]');
  /* Web Animations API есть не во всех старых мобильных браузерах.
     Анимация — украшение: если её нет, товар всё равно должен добавиться,
     поэтому выходим молча, а сам полёт обёрнут в try. */
  if (!target || !fromEl || typeof document.createElement('div').animate !== 'function') return;

  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'fly';
  chip.textContent = text;
  chip.style.left = a.left + a.width / 2 + 'px';
  chip.style.top = a.top + a.height / 2 + 'px';
  document.body.appendChild(chip);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);

  try {
    chip.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - 70}px)) scale(1.15)`, opacity: 1, offset: .55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.25)`, opacity: 0 }
      ],
      { duration: 780, easing: 'cubic-bezier(.4,0,.2,1)' }
    ).onfinish = () => chip.remove();
  } catch (_) {
    chip.remove();
  }
}

/* ------------------------------- Тост ------------------------------- */
let toastTimer;
function toast(msg, linkText, href) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${msg}</span>` + (linkText ? ` <a href="${href}">${linkText}</a>` : '');
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3600);
}

/* --------------------------- Картинки товара --------------------------- */
/* Пробуем расширения по очереди — фото со старого сайта бывают .jpg, .png и .webp */
const EXT = ['jpg', 'png', 'webp', 'jpeg'];

/* Номер фото для отделки: 0 — основное фото товара, 1..N — <id>-N.jpg.
   Соответствие «отделка → фото» лежит в photo-map.js, его заполняет
   скрипт переноса фотографий. Если соответствия нет, при клике по отделке
   пробуем фото с тем же порядковым номером и молча откатываемся к основному. */
function photoNo(p, colorIdx = 0, guess = false) {
  const m = (window.PHOTO_MAP || {})[p.id];
  if (m && Array.isArray(m.colors)) return m.colors[colorIdx] || 0;   // 0 — показать основное фото
  return guess ? colorIdx + 1 : 0;
}

function mediaHTML(p, cls = 'card-media', href = '') {
  const v = photoNo(p, 0);
  const inner = `
      <div class="ph">${ICON.box}<span>Фото: ${p.title}</span></div>
      <img alt="${p.title}" loading="lazy" decoding="async"
           style="opacity:0;position:absolute;inset:0"
           data-img="${p.id}"${v ? ` data-variant="${v}"` : ''}>`;
  return href
    ? `<a class="${cls}" href="${href}" aria-label="Открыть «${p.title}»">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
}

/* Возможные пути к файлу: сначала фото конкретной отделки, потом основное.
   Расширение заранее неизвестно, поэтому перебираем варианты по очереди. */
/* Какое расширение реально сработало у товара — чтобы при следующих
   переключениях отделки не перебирать все варианты заново */
const EXT_OK = {};

function imgSources(id, variant) {
  const exts = EXT_OK[id] ? [EXT_OK[id], ...EXT.filter((e) => e !== EXT_OK[id])] : EXT;
  const n = Number(variant) || 0;          // «0» из data-атрибута — это строка, она истинна
  const out = [];
  if (n) exts.forEach((e) => out.push(`images/products/${id}_${n}.${e}`));
  exts.forEach((e) => out.push(`images/products/${id}.${e}`));
  return out;
}

function loadImage(img, onMissing) {
  const list = imgSources(img.dataset.img, img.dataset.variant);
  const ph = img.parentElement && img.parentElement.querySelector('.ph');
  let i = 0;
  img.onload = () => {
    img.style.opacity = '1';
    if (ph) ph.style.display = 'none';
    const ext = (img.currentSrc || img.src || '').split('.').pop().toLowerCase();
    if (EXT.includes(ext)) EXT_OK[img.dataset.img] = ext;
  };
  img.onerror = () => {
    if (i < list.length) { img.src = path(list[i++]); return; }
    img.style.opacity = '0';
    if (ph) ph.style.display = '';
    if (typeof onMissing === 'function') onMissing(img);
  };
  img.onerror();
}

/* Миниатюры галереи грузятся отдельно — им нужен колбэк «файла нет».
   forEach передал бы вторым аргументом индекс, поэтому вызываем явно. */
const initImages = (root = document) =>
  $$('img[data-img]', root)
    .filter((img) => !img.closest('.pd-thumbs'))
    .forEach((img) => loadImage(img));

/* Смена отделки — смена фото */
function setPhoto(scope, p, colorIdx) {
  const img = $('img[data-img]', scope);
  if (!img) return;
  const n = photoNo(p, colorIdx, true);
  if (Number(img.dataset.variant || 0) === n) return;
  if (n) img.dataset.variant = n; else delete img.dataset.variant;
  loadImage(img);
  const thumb = $(`[data-photo="${n}"]`, scope);
  if (thumb) $$('[data-photo]', scope).forEach((x) => x.classList.toggle('is-on', x === thumb));
}

/* --------------------------- Карточка товара --------------------------- */
function cardHTML(p) {
  const cat = catById(p.cat);
  const url = path(`pages/product.html?id=${p.id}`);
  const colors = (p.colors || []).slice(0, 6);
  const sizes = p.sizes || [];

  return `
  <article class="card reveal" data-card="${p.id}">
    ${mediaHTML(p, 'card-media', url)}
    <div class="badges">
      ${p.isNew ? '<span class="badge badge--new">Новинка</span>' : ''}
      ${p.hit ? '<span class="badge badge--hit">Хит</span>' : ''}
    </div>
    <span class="stock"><i></i>В наличии</span>

    <div class="card-body">
      <p class="card-cat">${cat ? cat.short : ''}</p>
      <h3 class="card-title"><a href="${url}">${p.title}</a></h3>

      ${colors.length ? `
      <div class="opt-row" data-colors>
        <span class="opt-label">Отделка</span>
        ${colors.map((c, i) => `
          <button class="sw ${i === 0 ? 'is-on' : ''}" type="button"
                  style="${swatchStyle(c)}" data-color="${i}" title="${c}"
                  aria-label="Отделка: ${c}"></button>`).join('')}
      </div>` : ''}

      ${sizes.length > 1 ? `
      <div class="opt-row" data-sizes>
        <span class="opt-label">Размер, мм</span>
        ${sizes.map((s, i) => `
          <button class="chip ${i === (p.sizes.findIndex((x) => x.add === 0) || 0) ? 'is-on' : ''}" type="button"
                  data-size="${i}">${s.label}</button>`).join('')}
      </div>` : ''}

      <div class="card-foot">
        <div>
          <p class="price"><span data-count="${priceOf(p, defaultSize(p), 0)}" data-price>0</span> <small>₽</small></p>
          <p class="price-note">Розница · без доставки</p>
        </div>
        <button class="add" type="button" data-add="${p.id}" aria-label="Добавить «${p.title}» в корзину">${ICON.plus}<span>В корзину</span></button>
      </div>
    </div>
  </article>`;
}

const bedLike = (p) => p.cat.startsWith('krovati') || p.cat === 'garnitury' || p.cat === 'matrasy';

const defaultSize = (p) => {
  const i = (p.sizes || []).findIndex((s) => s.add === 0);
  return i < 0 ? 0 : i;
};

/* ------------------- Габариты под выбранное спальное место -------------------
   На старом сайте габариты записаны одной строкой: либо перечислением
   («975/1275/1475/1675×2120»), либо одним значением для базового размера.
   Во втором случае вычисляем припуск каркаса и применяем его к любому размеру. */
function dimsFor(p, sizeIndex = 0) {
  const sz = p.sizes?.[sizeIndex]?.label || '';
  const m = sz.match(/(\d+)\s*[×x]\s*(\d+)/);
  if (!m) return '';
  const w = Number(m[1]);
  const l = Number(m[2]);

  /* Снятое со старого сайта — самый точный источник */
  const fromSite = (window.DIMS_MAP || {})[p.id];
  if (fromSite && fromSite[w]) return fromSite[w];

  const key = Object.keys(p.specs || {}).find((k) => /^(Габариты \(Ш×Д\)|Кровать \(Ш×Д)/.test(k));
  const raw = key ? String(p.specs[key]) : '';
  const rm = raw.match(/^([\d\s/]+)[×x]\s*(\d+)/);

  if (rm) {
    const ws = rm[1].split('/').map((x) => Number(x.trim())).filter(Boolean);
    const len = Number(rm[2]);
    if (ws.length === p.sizes.length) return `${ws[sizeIndex]} × ${len} мм`;
    if (ws.length === 1) {
      const base = p.sizes[defaultSize(p)]?.label || '';
      const bm = base.match(/(\d+)\s*[×x]\s*(\d+)/);
      if (bm) return `${w + (ws[0] - Number(bm[1]))} × ${l + (len - Number(bm[2]))} мм`;
    }
  }
  /* pad: [припуск по ширине, припуск по длине] — если габаритов в характеристиках нет */
  if (Array.isArray(p.pad)) return `${w + p.pad[0]} × ${l + p.pad[1]} мм`;
  return '';
}

/* Коллекция товара — по названию. Нужна для блока «Смотрят вместе». */
const SETS = ['Лофти', 'Александра', 'Венеция', 'Гермес', 'Нимфа', 'Каприз', 'Вива',
              'Мэтро', 'Рэст', 'Слип', 'Твист', 'Сиеста', 'Канди', 'Ассоль', 'Катрин',
              'Грация', 'Шарм', 'Фэнси', 'Гранд', 'Арт', 'Софт'];
const setOf = (p) => SETS.find((n) => p.title.includes(n)) || '';

/* Чем дополняют покупку, если у товара нет своей коллекции */
const GOES_WITH = {
  'krovati-massiv': ['matrasy', 'tumby', 'komody'],
  'krovati-myagkie': ['matrasy', 'tumby', 'komody'],
  'krovati-detskie': ['matrasy', 'tumby'],
  'krovati-metall': ['matrasy'],
  'garnitury': ['matrasy', 'gostinye'],
  'shkafy': ['komody', 'tumby'],
  'komody': ['tumby', 'shkafy'],
  'tumby': ['komody', 'shkafy'],
  'matrasy': ['krovati-massiv'],
  'gostinye': ['tumby', 'shkafy'],
  'stoly': ['stulya'],
  'stulya': ['stoly']
};

/* Товары одной коллекции из других категорий: комод + шкаф + стеллаж + тумба */
function goesWith(p, limit = 4) {
  const set = setOf(p);
  let list = [];
  if (set) list = PRODUCTS.filter((x) => x.id !== p.id && x.cat !== p.cat && setOf(x) === set);
  if (list.length < limit) {
    const cats = GOES_WITH[p.cat] || [];
    const extra = PRODUCTS.filter((x) => x.id !== p.id && cats.includes(x.cat) && !list.includes(x));
    /* сначала хиты — их чаще берут в дополнение */
    extra.sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0));
    list = list.concat(extra);
  }
  return list.slice(0, limit);
}

/* Похожие товары: та же категория И та же коллекция.
   У комода «Лофти» в этом блоке должны быть только «Лофти», а не все комоды
   фабрики. Если своей коллекции у товара нет (комод №1, матрасы, стулья),
   показываем соседей по категории. Когда показывать нечего — блок скрывается. */
function similarTo(p, limit = 4) {
  const set = setOf(p);
  const sameCat = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id);
  const list = set ? sameCat.filter((x) => setOf(x) === set) : sameCat;
  return list
    .sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
    .slice(0, limit);
}

/* Переключение отделки / размера прямо в карточке */
function bindCards(root = document) {
  $$('[data-card]', root).forEach((card) => {
    const p = byId(card.dataset.card);
    if (!p) return;
    let color = 0;
    let size = defaultSize(p);

    $$('[data-color]', card).forEach((b) =>
      b.addEventListener('click', () => {
        color = Number(b.dataset.color);
        $$('[data-color]', card).forEach((x) => x.classList.toggle('is-on', x === b));
        setPhoto(card, p, color);
        countUp($('[data-price]', card), priceOf(p, size, color), { dur: 400 });
      })
    );

    $$('[data-size]', card).forEach((b) =>
      b.addEventListener('click', () => {
        size = Number(b.dataset.size);
        $$('[data-size]', card).forEach((x) => x.classList.toggle('is-on', x === b));
        countUp($('[data-price]', card), priceOf(p, size, color), { dur: 500 });
      })
    );

    const add = $('[data-add]', card);
    add?.addEventListener('click', () => {
      cartAdd(p.id, color, size, 1);
      flyToCart(add, '+1');
      add.innerHTML = ICON.check + '<span>Добавлено</span>';
      add.classList.add('is-done');
      setTimeout(() => {
        add.innerHTML = ICON.plus + '<span>В корзину</span>';
        add.classList.remove('is-done');
      }, 1400);
      toast(`«${p.title}» в корзине`, 'Оформить', path('pages/cart.html'));
    });
  });
}

/* ------------------------- Шапка, меню, подвал ------------------------- */
const NAV = [
  { href: 'pages/catalog.html', label: 'Каталог' },
  { href: 'pages/delivery.html', label: 'Доставка и оплата' },
  { href: 'pages/about.html', label: 'О фабрике' },
  { href: 'pages/faq.html', label: 'Вопросы' },
  { href: 'pages/contacts.html', label: 'Контакты' }
];

function renderHeader() {
  const host = $('#header');
  if (!host) return;
  const here = document.body.dataset.page || '';
  const main = COMPANY.managers[0];

  host.className = 'header';
  host.innerHTML = `
    <div class="wrap head-inner">
      <a class="logo" href="${path('index.html')}">
        <span class="logo-mark"><img src="${path('images/logo-mark.png')}" alt="" width="34" height="34"></span>
        <span class="logo-text">
          <span class="logo-name"><b>D</b>арина</span>
          <span class="logo-sub">мебельная фабрика</span>
        </span>
      </a>

      <nav class="head-nav">
        ${NAV.map((n) => `<a class="head-link ${here && n.href.includes(here) ? 'is-here' : ''}" href="${path(n.href)}">${n.label}</a>`).join('')}
      </nav>

      <div class="head-actions">
        <a class="head-phone" href="tel:${main.tel}">
          <b>${main.phone}</b>
          <span>${main.name} · пн–пт 8:00–17:00</span>
        </a>
        <a class="head-icon" href="tel:${main.tel}" aria-label="Позвонить">${ICON.phone}</a>
        <a class="head-icon" href="${path('pages/cart.html')}" aria-label="Корзина">
          ${ICON.cart}<span class="cart-badge" data-cart-badge>0</span>
        </a>
        <button class="burger" id="burger" type="button" aria-label="Меню" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>`;

  const menu = document.createElement('div');
  menu.className = 'mmenu';
  menu.id = 'mmenu';
  menu.innerHTML = `
    <div class="mmenu-list">
      ${NAV.map((n) => `<a href="${path(n.href)}">${n.label}</a>`).join('')}
    </div>
    <p class="f-title">Категории</p>
    <div class="mmenu-cats">
      ${CATEGORIES.map((c) => `<a href="${path('pages/catalog.html')}?cat=${c.id}">${c.short}</a>`).join('')}
    </div>
    <p class="f-title">Телефоны</p>
    <div class="mmenu-phones">
      ${COMPANY.managers.map((m) => `<a href="tel:${m.tel}">${m.phone} — ${m.name}</a>`).join('')}
    </div>`;
  document.body.appendChild(menu);

  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });

  const onScroll = () => host.classList.toggle('is-stuck', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function renderFooter() {
  const host = $('#footer');
  if (!host) return;
  host.className = 'footer';
  host.innerHTML = `
    <div class="wrap">
      <div class="f-grid">
        <div>
          <a class="logo" href="${path('index.html')}" style="margin-bottom:.9rem">
            <span class="logo-mark"><img src="${path('images/logo-mark.png')}" alt="" width="34" height="34"></span>
            <span class="logo-text">
              <span class="logo-name" style="color:var(--ink)"><b style="color:var(--brand)">D</b>арина</span>
              <span class="logo-sub" style="color:var(--muted)">мебельная фабрика</span>
            </span>
          </a>
          <p style="font-size:.88rem;color:var(--ink-2);max-width:34ch">
            Производство мебели из массива сосны с ${COMPANY.since} года. Кровати, спальни, корпусная мебель.
            Розница и опт, отгрузка со склада по всей России.
          </p>
        </div>

        <div>
          <p class="f-title">Каталог</p>
          <div class="f-list">
            ${CATEGORIES.slice(0, 6).map((c) => `<a href="${path('pages/catalog.html')}?cat=${c.id}">${c.title}</a>`).join('')}
            <a href="${path('pages/catalog.html')}">Все категории →</a>
          </div>
        </div>

        <div>
          <p class="f-title">Компания</p>
          <div class="f-list">
            ${NAV.map((n) => `<a href="${path(n.href)}">${n.label}</a>`).join('')}
          </div>
        </div>

        <div>
          <p class="f-title">Связаться</p>
          <div class="f-list">
            ${COMPANY.managers.map((m) => `
              <a class="f-phone" href="tel:${m.tel}"><b>${m.phone}</b><span>${m.name}</span></a>`).join('')}
            <a href="mailto:${COMPANY.orderEmail}">${COMPANY.orderEmail}</a>
          </div>
          <p style="font-size:.82rem;margin-top:.9rem;color:var(--muted)">
            <a href="${COMPANY.map}" target="_blank" rel="noopener" style="color:inherit">${COMPANY.address}</a>
          </p>
          <p style="font-size:.82rem;color:var(--muted)">${COMPANY.hours}</p>
        </div>
      </div>

      <div class="f-bottom">
        <p>© ${new Date().getFullYear()} ${COMPANY.name}. ИНН ${COMPANY.inn}</p>
        <p>Цены указаны без учёта доставки. Стоимость доставки рассчитывает менеджер после заявки.</p>
      </div>
    </div>`;
}

function renderFab() {
  if ($('#fab')) return;
  const a = document.createElement('a');
  a.id = 'fab';
  a.className = 'fab';
  a.href = path('pages/cart.html');
  a.innerHTML = `${ICON.cart}<span>Корзина</span><b data-fab-count>0</b><span data-fab-sum></span>`;
  document.body.appendChild(a);
}

/* ------------------------------ Аккордеон ------------------------------ */
function bindAccordion(root = document) {
  $$('.acc-item', root).forEach((item) => {
    const q = $('.acc-q', item);
    q?.addEventListener('click', () => item.classList.toggle('is-open'));
  });
}

/* --------------------------- Страница: каталог --------------------------- */
function initCatalog() {
  const grid = $('#catalog-grid');
  if (!grid) return;

  const params = new URLSearchParams(location.search);
  let cat = params.get('cat') || 'all';
  let sort = 'default';

  const filters = $('#catalog-filters');
  const counter = $('#catalog-count');
  const sortSel = $('#catalog-sort');

  filters.innerHTML =
    `<button class="chip" data-cat="all">Все позиции</button>` +
    CATEGORIES.map((c) => {
      const n = PRODUCTS.filter((p) => p.cat === c.id).length;
      return `<button class="chip" data-cat="${c.id}">${c.short} <span style="opacity:.55">${n}</span></button>`;
    }).join('');

  const render = () => {
    let list = cat === 'all' ? [...PRODUCTS] : PRODUCTS.filter((p) => p.cat === cat);

    if (sort === 'asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));

    $$('[data-cat]', filters).forEach((b) => b.classList.toggle('is-on', b.dataset.cat === cat));

    const title = $('#catalog-title');
    if (title) title.textContent = cat === 'all' ? 'Весь каталог' : catById(cat).title;

    counter.innerHTML = `<span data-count="${list.length}" data-dur="700">0</span> ${plural(list.length, ['позиция', 'позиции', 'позиций'])} в наличии`;

    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<p class="empty">В этой категории пока пусто. Загляните в соседнюю или позвоните — подберём вручную.</p>';

    initImages(grid);
    bindCards(grid);
    watchCounters(grid);
    watchCounters(counter);
    watchReveals(grid);
  };

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    history.replaceState(null, '', cat === 'all' ? location.pathname : `?cat=${cat}`);
    render();
  });

  sortSel?.addEventListener('change', () => { sort = sortSel.value; render(); });

  render();
}

/* -------------------------- Страница: товар -------------------------- */
/* --------------------------- Просмотр фотографии ---------------------------
   Снимок в карточке открывается на весь экран: у мебели важны детали
   фасада и фурнитуры, а в обычном размере их не разглядеть. */
function openViewer(product, startIndex, total) {
  let i = startIndex;
  const box = document.createElement('div');
  box.className = 'viewer is-on';
  box.innerHTML = `
    <img alt="${product.title}">
    <button class="viewer-close" type="button" aria-label="Закрыть">✕</button>
    ${total > 1 ? `
      <button class="viewer-nav viewer-nav--prev" type="button" aria-label="Предыдущее фото">‹</button>
      <button class="viewer-nav viewer-nav--next" type="button" aria-label="Следующее фото">›</button>
      <span class="viewer-count"></span>` : ''}`;
  document.body.appendChild(box);
  document.body.style.overflow = 'hidden';

  const img = $('img', box);
  const count = $('.viewer-count', box);

  const show = () => {
    img.dataset.img = product.id;
    if (i > 0) img.dataset.variant = i; else delete img.dataset.variant;
    loadImage(img);
    if (count) count.textContent = `${i || 1} / ${total}`;
  };

  const close = () => {
    box.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };

  const step = (d) => {
    i = ((i - 1 + d + total) % total) + 1;
    show();
  };

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }

  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.closest('.viewer-close')) { close(); return; }
    if (e.target.closest('.viewer-nav--prev')) step(-1);
    if (e.target.closest('.viewer-nav--next')) step(1);
  });
  document.addEventListener('keydown', onKey);

  show();
}

function initProduct() {
  const host = $('#product');
  if (!host) return;

  const id = new URLSearchParams(location.search).get('id');
  const p = byId(id);

  if (!p) {
    host.innerHTML = `<p class="empty">Позиция не найдена. <a href="${path('pages/catalog.html')}" style="color:var(--brand);text-decoration:underline">Открыть каталог</a></p>`;
    return;
  }

  document.title = `${p.title} — ${COMPANY.name}`;
  const cat = catById(p.cat);
  const shots = ((window.PHOTO_MAP || {})[p.id] || {}).count || 0;
  let color = 0;
  let size = defaultSize(p);
  let qty = 1;
  const opts = (p.opts || []).map(() => 0);

  const crumbs = $('#crumbs');
  if (crumbs) {
    crumbs.innerHTML = `
      <a href="${path('index.html')}">Главная</a> / 
      <a href="${path('pages/catalog.html')}">Каталог</a> / 
      <a href="${path('pages/catalog.html')}?cat=${p.cat}">${cat.title}</a> / 
      <span>${p.title}</span>`;
  }

  host.innerHTML = `
    <div class="pd">
      <div>
        ${mediaHTML(p, 'pd-media')}
        <div class="badges">
          ${p.isNew ? '<span class="badge badge--new">Новинка</span>' : ''}
          ${p.hit ? '<span class="badge badge--hit">Хит продаж</span>' : ''}
        </div>
        <div class="pd-thumbs">
          ${Array.from({ length: shots || 12 }, (_, i) => `
            <button class="pd-thumb${i === 0 ? ' is-on' : ''}" type="button" data-photo="${i + 1}"
                    aria-label="Фото ${i + 1}">
              <img alt="" loading="lazy" decoding="async" data-img="${p.id}" data-variant="${i + 1}">
            </button>`).join('')}
        </div>
      </div>

      <div>
        <p class="pd-sub">${cat.title} · ${COMPANY.short}</p>
        <h1 class="pd-title">${p.title}</h1>
        <p style="margin:.75rem 0 1.25rem;max-width:46ch">${p.desc}</p>

        <p style="display:inline-flex;align-items:center;gap:.4rem;font-family:var(--f-mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ok);margin-bottom:1rem">
          <i style="width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block"></i> В наличии на складе
        </p>

        <div class="pd-box">
          ${p.colors?.length ? `
          <div class="pd-group">
            <div class="pd-group-t"><span>Вариант исполнения</span><b data-color-name>${p.colors[0]}</b></div>
            <div class="pd-opts">
              ${p.colors.map((c, i) => `
                <button class="sw sw--lg ${i === 0 ? 'is-on' : ''}" type="button"
                        style="${swatchStyle(c)}" data-color="${i}" title="${c}" aria-label="${c}"></button>`).join('')}
            </div>
          </div>` : ''}

          ${p.sizes?.length ? `
          <div class="pd-group">
            <div class="pd-group-t"><span>${bedLike(p) ? 'Спальное место, мм' : 'Размер, мм'}</span></div>
            <div class="pd-opts">
              ${p.sizes.map((s, i) => `
                <button class="chip chip--lg ${i === size ? 'is-on' : ''}" type="button" data-size="${i}">${s.label}</button>`).join('')}
            </div>
            ${dimsFor(p, size) ? `
            <p class="pd-dims">Габаритные размеры: <b data-dims>${dimsFor(p, size)}</b></p>` : ''}
          </div>` : ''}

          ${(p.opts || []).map((o, gi) => `
          <div class="pd-group">
            <div class="pd-group-t"><span>${o.n}</span></div>
            <div class="pd-opts">
              ${o.v.map((v, i) => `
                <button class="chip chip--lg ${i === 0 ? 'is-on' : ''}" type="button"
                        data-opt="${gi}" data-val="${i}">${v}</button>`).join('')}
            </div>
          </div>`).join('')}

          <div class="pd-group">
            <div class="pd-group-t"><span>Цена</span></div>
            <p class="pd-price"><span data-count="${priceOf(p, size, color)}" data-price>0</span> <small>₽</small></p>
            <p class="price-note" style="margin-top:.35rem">Розница · цена без доставки, её считает менеджер</p>
          </div>

          <div class="pd-group" style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
            <div class="qty">
              <button type="button" data-q="-1" aria-label="Меньше">−</button>
              <span data-qty>1</span>
              <button type="button" data-q="1" aria-label="Больше">+</button>
            </div>
            <button class="btn btn--primary" style="flex:1;min-width:180px" type="button" id="pd-add">
              ${ICON.cart} Добавить в корзину
            </button>
          </div>
        </div>

        <div class="pd-box" style="margin-top:1rem">
          <div class="pd-group-t"><span>Характеристики</span></div>
          <table class="spec">
            ${Object.entries(p.specs).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
          </table>
        </div>
      </div>
    </div>`;

  initImages(host);
  watchCounters(host);

  /* Сколько у товара фото на самом деле, знает только браузер: рисуем ленту
     с запасом, а кнопки без файла убираем. Так у каждого товара в ленте
     оказываются ровно его снимки, без пустых квадратов. */
  const thumbs = $('.pd-thumbs', host);
  if (thumbs) {
    $$('.pd-thumb img', thumbs).forEach((img) =>
      loadImage(img, () => {
        img.closest('.pd-thumb').remove();
        if (thumbs.querySelectorAll('.pd-thumb').length < 2) thumbs.remove();
      })
    );
  }

  const media = $('.pd-media', host);
  if (media) {
    media.addEventListener('click', () => {
      const cur = Number($('img[data-img]', media)?.dataset.variant || 0);
      openViewer(p, cur, Math.max(shots || 1, cur || 1));
    });
  }

  const priceEl = $('[data-price]', host);

  $$('[data-color]', host).forEach((b) =>
    b.addEventListener('click', () => {
      color = Number(b.dataset.color);
      $$('[data-color]', host).forEach((x) => x.classList.toggle('is-on', x === b));
      $('[data-color-name]', host).textContent = p.colors[color];
      setPhoto(host, p, color);
      countUp(priceEl, priceOf(p, size, color), { dur: 400 });
    })
  );

  $$('[data-photo]', host).forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-photo]', host).forEach((x) => x.classList.toggle('is-on', x === b));
      const main = $('.pd-media img[data-img]', host);
      main.dataset.variant = b.dataset.photo;
      loadImage(main);
    })
  );

  $$('[data-size]', host).forEach((b) =>
    b.addEventListener('click', () => {
      size = Number(b.dataset.size);
      $$('[data-size]', host).forEach((x) => x.classList.toggle('is-on', x === b));
      countUp(priceEl, priceOf(p, size, color), { dur: 500 });
      const dims = $('[data-dims]', host);
      if (dims) dims.textContent = dimsFor(p, size);
    })
  );

  $$('[data-opt]', host).forEach((b) =>
    b.addEventListener('click', () => {
      const gi = Number(b.dataset.opt);
      opts[gi] = Number(b.dataset.val);
      $$(`[data-opt="${gi}"]`, host).forEach((x) => x.classList.toggle('is-on', x === b));
    })
  );

  $$('[data-q]', host).forEach((b) =>
    b.addEventListener('click', () => {
      qty = Math.max(1, Math.min(99, qty + Number(b.dataset.q)));
      $('[data-qty]', host).textContent = qty;
    })
  );

  const addBtn = $('#pd-add');
  addBtn.addEventListener('click', () => {
    cartAdd(p.id, color, size, qty, opts.slice());
    flyToCart(addBtn, '+' + qty);
    toast(`«${p.title}» × ${qty} в корзине`, 'Оформить', path('pages/cart.html'));
  });

  /* Блоки рекомендаций: «Смотрят вместе» — одна коллекция целиком,
     «Похожие товары» — соседи по категории */
  const fill = (sel, list) => {
    const box = $(sel);
    if (!box) return;
    if (!list.length) { box.closest('section')?.remove(); return; }
    box.innerHTML = list.map(cardHTML).join('');
    initImages(box);
    bindCards(box);
    watchCounters(box);
    watchReveals(box);
  };

  const together = goesWith(p, 4);
  fill('#related', together);

  const setName = setOf(p);
  const relHead = $('#related-head');
  if (relHead && setName && together.some((x) => setOf(x) === setName)) {
    relHead.textContent = `Коллекция «${setName}» целиком`;
  }

  fill('#similar', similarTo(p, 4));
}

/* -------------------------- Страница: корзина -------------------------- */
function initCart() {
  const host = $('#cart');
  if (!host) return;

  const render = () => {
    const items = cartRead();

    if (!items.length) {
      host.innerHTML = `
        <div class="empty">
          <p style="font-size:1.05rem;margin-bottom:1rem">В корзине пока пусто.</p>
          <p style="margin-bottom:1.5rem">Отметьте позиции в каталоге — потом отправите их одной заявкой, и менеджер посчитает доставку.</p>
          <a class="btn btn--primary" href="${path('pages/catalog.html')}">Открыть каталог</a>
        </div>`;
      return;
    }

    const total = cartTotal();

    host.innerHTML = `
      <div class="cart-grid">
        <div>
          <div style="display:grid;gap:.6rem" id="cart-items">
            ${items.map((i, idx) => {
              const p = byId(i.id);
              if (!p) return '';
              const line = priceOf(p, i.size, i.color) * i.qty;
              return `
              <div class="citem">
                ${mediaHTML(p, 'citem-media')}
                <div>
                  <h3>${p.title}</h3>
                  <p class="citem-meta">
                    ${chosenOf(p, i).map(([k, v]) => `${k}: ${v}`).join('<br>')}
                    ${chosenOf(p, i).length ? '<br>' : ''}${money(priceOf(p, i.size, i.color))} ₽ за шт.
                  </p>
                  <div class="citem-foot">
                    <div class="qty">
                      <button type="button" data-dec="${idx}" aria-label="Меньше">−</button>
                      <span>${i.qty}</span>
                      <button type="button" data-inc="${idx}" aria-label="Больше">+</button>
                    </div>
                    <span class="citem-price">${money(line)} ₽</span>
                    <button class="citem-del" type="button" data-del="${idx}">Убрать</button>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>

          <p style="font-size:.8rem;color:var(--muted);margin-top:1rem">
            Цены розничные и указаны без доставки. Нужен опт — напишите об этом в комментарии, менеджер пришлёт прайс.
          </p>
        </div>

        <div>
          <div class="summary">
            <div class="sum-row"><span>Позиций</span><span>${items.length}</span></div>
            <div class="sum-row"><span>Товаров, шт.</span><span>${cartCount()}</span></div>
            <div class="sum-row"><span>Доставка</span><span>Считает менеджер</span></div>
            <div class="sum-total">
              <span>Итого</span>
              <b><span data-count="${total}" data-dur="900">0</span> ₽</b>
            </div>

            <hr class="divider" style="margin:1.15rem 0">

            <p class="pd-group-t"><span>Заявка</span></p>
            <form id="order-form" novalidate>
              <div class="field">
                <label for="f-city">Город <span>*</span></label>
                <input id="f-city" name="city" type="text" autocomplete="address-level2" placeholder="Например, Краснодар">
              </div>
              <div class="field">
                <label for="f-name">Имя <span>*</span></label>
                <input id="f-name" name="name" type="text" autocomplete="name" placeholder="Как к вам обращаться">
              </div>
              <div class="field">
                <label for="f-phone">Телефон <span>*</span></label>
                <input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__">
                <span class="hint">Менеджер перезвонит в рабочее время и посчитает доставку.</span>
              </div>
              <div class="field">
                <label for="f-note">Комментарий</label>
                <textarea id="f-note" name="note" placeholder="Отделка, сроки, опт, самовывоз — что важно знать"></textarea>
              </div>

              <label class="consent">
                <input type="checkbox" id="f-agree" checked>
                <span>Согласен на обработку персональных данных для обратной связи по заявке.</span>
              </label>

              <button class="btn btn--primary btn--block" type="submit" id="order-send">Отправить заявку</button>
              <div class="form-msg" id="order-msg"></div>
            </form>
          </div>
        </div>
      </div>`;

    initImages(host);
    watchCounters(host);

    $$('[data-inc]', host).forEach((b) => b.addEventListener('click', () => { cartSetQty(+b.dataset.inc, cartRead()[+b.dataset.inc].qty + 1); render(); }));
    $$('[data-dec]', host).forEach((b) => b.addEventListener('click', () => { cartSetQty(+b.dataset.dec, cartRead()[+b.dataset.dec].qty - 1); render(); }));
    $$('[data-del]', host).forEach((b) => b.addEventListener('click', () => { cartRemove(+b.dataset.del); render(); }));

    bindOrderForm(render);
  };

  render();
}

/* Текст заявки — он же уходит на почту */
function orderText() {
  const items = cartRead();
  const lines = items.map((i, n) => {
    const p = byId(i.id);
    if (!p) return '';
    const head = `${n + 1}. ${p.title} — ${i.qty} шт. — ${money(priceOf(p, i.size, i.color) * i.qty)} ₽`;
    const details = chosenOf(p, i).map(([k, v]) => `      ${k}: ${v}`);
    return [head, ...details].join('\n');
  });
  return lines.filter(Boolean).join('\n\n');
}

function bindOrderForm(afterSuccess) {
  const form = $('#order-form');
  if (!form) return;
  const msg = $('#order-msg');
  const btn = $('#order-send');

  const setMsg = (text, ok) => {
    msg.textContent = text;
    msg.className = 'form-msg is-on ' + (ok ? 'form-msg--ok' : 'form-msg--bad');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const city = $('#f-city');
    const name = $('#f-name');
    const phone = $('#f-phone');
    const note = $('#f-note');
    const agree = $('#f-agree');

    [city, name, phone].forEach((f) => f.classList.remove('is-bad'));

    const digits = phone.value.replace(/\D/g, '');
    let bad = null;
    if (!city.value.trim()) bad = city;
    else if (!name.value.trim()) bad = name;
    else if (digits.length < 10) bad = phone;

    if (bad) {
      bad.classList.add('is-bad');
      bad.focus();
      setMsg(bad === phone ? 'Проверьте номер телефона: нужно минимум 10 цифр.' : 'Заполните поле — без него менеджер не сможет перезвонить.', false);
      return;
    }
    if (!agree.checked) { setMsg('Отметьте согласие на обработку данных.', false); return; }

    const payload = {
      access_key: ORDER.accessKey,
      subject: `${ORDER.subject} — ${name.value.trim()}, ${city.value.trim()}`,
      from_name: 'Сайт «Dарина»',
      'Имя': name.value.trim(),
      'Город': city.value.trim(),
      'Телефон': phone.value.trim(),
      'Комментарий': note.value.trim() || '—',
      'Заказ': orderText(),
      'Итого, ₽': money(cartTotal()),
      'Позиций': String(cartRead().length),
      'Отправлено': new Date().toLocaleString('ru-RU')
    };

    btn.disabled = true;
    btn.textContent = 'Отправляем…';

    try {
      const res = await fetch(ORDER.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      /* Web3Forms отвечает 200 и на отказ, поэтому смотрим не код, а поле success */
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'HTTP ' + res.status);
      }

      localStorage.removeItem(CART_KEY);
      syncCartUI();
      showDone(name.value.trim());
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Отправить заявку';
      const body = encodeURIComponent(
        `Город: ${city.value}\nИмя: ${name.value}\nТелефон: ${phone.value}\nКомментарий: ${note.value || '—'}\n\nЗаказ:\n${orderText()}\n\nИтого: ${money(cartTotal())} ₽`
      );
      msg.innerHTML =
        `Не получилось отправить с сайта. Напишите нам напрямую — заявка уже подставлена в письмо: ` +
        `<a href="mailto:${COMPANY.orderEmail}?subject=Заявка с сайта&body=${body}" style="text-decoration:underline">${COMPANY.orderEmail}</a>` +
        ` или позвоните <a href="tel:${COMPANY.managers[0].tel}" style="text-decoration:underline">${COMPANY.managers[0].phone}</a>.`;
      msg.className = 'form-msg is-on form-msg--bad';
    }
  });
}

function showDone(name) {
  const host = $('#cart');
  host.innerHTML = `
    <div class="done">
      <div class="done-mark">${ICON.check}</div>
      <h2 style="font-family:var(--f-display)">Заявка отправлена</h2>
      <p style="max-width:48ch;margin:.85rem auto 1.75rem">
        ${name ? name + ', с' : 'С'}пасибо. Заявка ушла на ${COMPANY.orderEmail}.
        Менеджер перезвонит в рабочее время, подтвердит наличие и посчитает доставку до вашего города.
      </p>
      <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <a class="btn btn--primary" href="${path('pages/catalog.html')}">Вернуться в каталог</a>
        <a class="btn btn--line" href="tel:${COMPANY.managers[0].tel}">${COMPANY.managers[0].phone}</a>
      </div>
    </div>`;
}

/* ------------------------- Главная: подборки ------------------------- */
/* Фото первого экрана.
   Сначала ищем свой файл images/hero.jpg (или .png / .webp), а если его нет —
   подставляем фото товара из data-fallback. Так первый экран не остаётся
   пустым сразу после переноса фотографий. */
function initHero() {
  const img = $('[data-hero]');
  if (!img) return;
  const ph = img.parentElement && img.parentElement.querySelector('.ph');
  const id = img.dataset.fallback || '';
  const list = [
    ...EXT.map((e) => `images/hero.${e}`),
    ...(id ? EXT.map((e) => `images/products/${id}.${e}`) : []),
    'images/interior/interior-01.jpg'          // последний запасной вариант
  ];
  let i = 0;
  img.style.opacity = '0';
  img.style.transition = 'opacity .5s var(--e)';
  img.onload = () => { img.style.opacity = '1'; if (ph) ph.style.display = 'none'; };
  img.onerror = () => { if (i < list.length) img.src = path(list[i++]); };
  img.onerror();
}

function initHome() {
  initHero();

  const cats = $('#home-cats');
  if (cats) {
    cats.innerHTML = CATEGORIES.map((c) => {
      const n = PRODUCTS.filter((p) => p.cat === c.id).length;
      return `
        <a class="cat-card reveal" href="${path('pages/catalog.html')}?cat=${c.id}">
          <span class="cat-media">
            ${c.cover ? `<img alt="" loading="lazy" decoding="async" data-img="${c.cover}">` : ''}
          </span>
          <span class="cat-count">${n}</span>
          <h3>${c.title}</h3>
          <p class="cat-note">${c.note}</p>
        </a>`;
    }).join('');
    $$('.cat-media img', cats).forEach((img) => {
      img.addEventListener('load', () => img.closest('.cat-card').classList.add('has-photo'));
      loadImage(img, () => img.remove());        // обложки нет — карточка остаётся текстовой
    });
  }

  const hits = $('#home-hits');
  if (hits) {
    hits.innerHTML = PRODUCTS.filter((p) => p.hit).slice(0, 8).map(cardHTML).join('');
    initImages(hits);
    bindCards(hits);
    watchCounters(hits);
  }

  const gallery = $('#home-gallery');
  if (gallery) {
    gallery.innerHTML = INTERIOR.map((f, i) => `
      <figure class="reveal">
        <div class="ph">${ICON.tree}<span>Интерьер ${i + 1}</span></div>
        <img src="${path('images/interior/' + f)}" alt="Мебель «Dарина» в интерьере" loading="lazy" decoding="async"
             style="position:absolute;inset:0;opacity:0" onload="this.style.opacity=1;this.previousElementSibling.style.display='none'"
             onerror="this.remove()">
      </figure>`).join('');
  }
}

/* ------------------------------- Старт ------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  /* Страховка от повторного запуска: некоторые хостинги-конструкторы
     подключают скрипт дважды — иначе обработчики навесились бы дважды */
  if (window.__darinaReady) return;
  window.__darinaReady = true;

  renderHeader();
  renderFooter();
  renderFab();
  syncCartUI();

  initHome();
  initCatalog();
  initProduct();
  initCart();

  bindAccordion();
  watchCounters();
  watchReveals();

  /* Бегущая строка: дублируем содержимое, чтобы шов не был виден */
  const track = $('.ticker-track');
  if (track) track.innerHTML += track.innerHTML;
});
