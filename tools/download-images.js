/* ============================================================
   Перенос фотографий со старого сайта darinameb.ru на новый.

   Запуск (Node.js 18+), из папки проекта:
       node tools/download-images.js          обычный запуск
       node tools/download-images.js --fresh  скачать всё заново
       node tools/download-images.js --map    только пересобрать карту,
                                              без обращения к сайту

   Что делает:
     • качает ВСЕ фотографии каждого товара: images/products/<id>_1.jpg,
       <id>_2.jpg и так далее, а первую дублирует как <id>.jpg;
     • сам сопоставляет фото с отделками и пишет это в photo-map.js;
     • качает интерьеры в images/interior/ и логотип;
     • пишет понятный отчёт images/products/ФОТО-ПО-ОТДЕЛКАМ.txt,
       где рядом с номером фото указано исходное имя файла со старого
       сайта — по нему легко вписать номер там, где не распозналось.

   ВАЖНО: запускать, пока старый сайт ещё работает на домене.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE = 'https://darinameb.ru';
const ROOT = path.join(__dirname, '..');
const DIR_P = path.join(ROOT, 'images', 'products');
const DIR_I = path.join(ROOT, 'images', 'interior');
const MANIFEST = path.join(DIR_P, '_sources.json');

const MODE_FRESH = process.argv.includes('--fresh');
const MODE_MAP = process.argv.includes('--map');

const INTERIOR_SRC = [
  'whatsapp_image_2024-09-02_at_095859.jpg', 'whatsapp_image_2024-09-02_at_085728.jpg',
  'whatsapp_image_2024-09-02_at_084858.jpg', 'whatsapp_image_2024-09-02_at_084608.jpg',
  'whatsapp_image_2024-09-02_at_084441.jpg', 'whatsapp_image_2024-09-02_at_084335.jpg',
  'whatsapp_image_2024-09-02_at_083801.jpg', 'whatsapp_image_2024-09-02_at_084222.jpg',
  'whatsapp_image_2024-09-02_at_083512.jpg', 'fensi.jpg',
  'slip_2_yar.jpg', 'slip_1yar.jpg'
];

/* ------------------------------ Сеть ------------------------------ */

const get = (url, asText = false, redirects = 0) =>
  new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 darina-migration' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 4) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : SITE + res.headers.location;
        res.resume();
        return resolve(get(next, asText, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(asText ? Buffer.concat(chunks).toString('utf8') : Buffer.concat(chunks)));
    }).on('error', reject);
  });

const save = (file, buf) => {
  if (buf.length < 1024) throw new Error('файл слишком мал, похоже на заглушку');
  fs.writeFileSync(file, buf);
};

/* Рядом с отделками на старом сайте лежат маленькие квадратики-образцы цвета.
   Их легко спутать с фотографией товара, поэтому отсеиваем по размеру:
   читаем ширину и высоту прямо из заголовка файла. */
const MIN_SIDE = 400;      // меньше этого по стороне — точно не фото товара
const SWATCH_SHOWN = 200;  // и всё, что выводится на странице мелким квадратиком

function imageSize(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {          // PNG
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf.slice(0, 3).toString('latin1') === 'GIF') {                   // GIF
      return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    }
    if (buf.length > 30 && buf.slice(0, 4).toString('latin1') === 'RIFF'
        && buf.slice(8, 12).toString('latin1') === 'WEBP') {              // WebP
      const fmt = buf.slice(12, 16).toString('latin1');
      if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
      }
      if (fmt === 'VP8X') {
        return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
      }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {                             // JPEG
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch (_) { /* заголовок не разобрался — считаем размер неизвестным */ }
  return null;
}

const isSwatch = (size) => size && (size.w < MIN_SIDE || size.h < MIN_SIDE);

/* --------------------------- Транслитерация --------------------------- */

const RU = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya'
};

const translit = (s) => s.toLowerCase().split('').map((ch) => (ch in RU ? RU[ch] : ch)).join('');

/* «й» на сайте пишут то как j, то как y или i — сверяем по всем вариантам */
const variants = (w) => [...new Set([w, w.replace(/j/g, 'y'), w.replace(/j/g, 'i'), w.replace(/y/g, 'i')])];

/* Слова, которые есть почти у всех отделок и ничего не различают */
const STOP = ['vstavka', 'velyur', 'nozhki', 'tkan', 'stoleshnica', 'beton', 'lajt', 'lait'];

const colorWords = (name) =>
  translit(name).split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.includes(w));

/* ------------------------- Разбор страницы товара ------------------------- */

const CUT = ['Рекомендуем', 'Похожие', 'С этим товаром', 'Сопутствующие',
             'Вы смотрели', 'Смотрите также', 'Новинки', 'Хиты продаж'];

const JUNK = /spacer|blank|noimage|no_photo|logo|banner|icon|favicon|sprite/;

function photosOf(rawHtml) {
  let html = rawHtml;
  CUT.forEach((k) => {
    const i = html.indexOf(k);
    if (i > 0) html = html.slice(0, i);
  });

  const found = [];
  /* shown — самый крупный размер, в котором картинка выводится на странице.
     Образцы отделки везде показаны квадратиком ~96 px, фото товара — крупно. */
  const push = (file, url, shown) => {
    file = file.toLowerCase();
    if (JUNK.test(file) || !/\.(jpe?g|png|webp)$/.test(file)) return;
    const has = found.find((x) => x.file === file);
    if (has) {
      if (!has.thumb && url) has.thumb = url;
      if (shown > has.shown) has.shown = shown;
      return;
    }
    found.push({ file, thumb: url || '', url: `${SITE}/d/${file}`, shown });
  };

  /* размер из адреса превью: 750r750, 96r96, 1920r, либо r — оригинал */
  const shownOf = (seg) => {
    if (seg === 'r') return Infinity;
    const nums = seg.match(/\d+/g);
    return nums ? Math.max(...nums.map(Number)) : Infinity;
  };

  const re1 = /\/thumb\/2\/[A-Za-z0-9_-]+\/([^/]+)\/d\/([^"'\s>\\]+)/g;
  let m;
  while ((m = re1.exec(html))) push(m[2], SITE + m[0], shownOf(m[1]));

  const re2 = /["'(]\/d\/([^"'\s)>\\]+)/g;
  while ((m = re2.exec(html))) push(m[1], SITE + '/d/' + m[1], Infinity);

  return found.slice(0, 14);
}

/* ------------------- Сопоставление отделок с фотографиями -------------------
   Одно фото — одной отделке: сначала раздаём самые уверенные совпадения
   по имени файла, потом добираем оставшихся по расположению в разметке. */

function assignColors(colors, files, html) {
  const res = new Array(colors.length).fill(0);
  const taken = new Set();

  const pairs = [];
  colors.forEach((c, ci) => {
    const words = colorWords(c);
    files.forEach((f, fi) => {
      const hits = words.filter((w) => variants(w).some((v) => f.includes(v))).length;
      if (hits) pairs.push({ ci, fi, score: hits });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  pairs.forEach(({ ci, fi }) => {
    if (res[ci] || taken.has(fi)) return;
    res[ci] = fi + 1;
    taken.add(fi);
  });

  colors.forEach((c, ci) => {
    if (res[ci]) return;
    const at = html.indexOf(c);
    if (at < 0) return;
    let best = -1;
    let bestDist = 2500;
    files.forEach((f, fi) => {
      if (taken.has(fi)) return;
      const pos = html.indexOf(f);
      if (pos < 0) return;
      const dist = Math.abs(pos - at);
      if (dist < bestDist) { bestDist = dist; best = fi; }
    });
    if (best >= 0) { res[ci] = best + 1; taken.add(best); }
  });

  return res;
}

/* ------------------- Габаритные размеры со старого сайта -------------------
   На странице товара есть строки «Спальное место» и «Габаритные размеры».
   Забираем обе и складываем в соответствие: ширина спального места → габарит.
   Так сайт покажет верный габарит для любого выбранного размера. */

const NUMS = /[0-9][0-9\s/×xх*.,-]*[0-9]/;

function plainText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n');
}

function grabSpec(text, label) {
  const re = new RegExp(label + '[^\n]{0,40}\n+\s*(' + NUMS.source + ')', 'i');
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, '') : '';
}

/* «975/1275/1475/1675×2120» → { widths: [975,1275,1475,1675], len: 2120 } */
function splitDim(v) {
  const m = String(v).match(/^([\d/.,-]+)[×xх*](\d+)/i);
  if (!m) return null;
  const widths = m[1].split(/[/,]/).map((x) => parseInt(x, 10)).filter(Boolean);
  return widths.length ? { widths, len: parseInt(m[2], 10) } : null;
}

function dimsOf(html) {
  const text = plainText(html);
  const bed = splitDim(grabSpec(text, 'Спальное место'));
  const all = splitDim(grabSpec(text, 'Габаритные размеры'));
  if (!bed || !all) return null;

  const out = {};
  if (bed.widths.length === all.widths.length) {
    bed.widths.forEach((w, i) => { out[w] = `${all.widths[i]} × ${all.len} мм`; });
  } else {
    /* Списки разной длины — считаем припуск по первому размеру и применяем ко всем */
    const padW = all.widths[0] - bed.widths[0];
    const padL = all.len - bed.len;
    bed.widths.forEach((w) => { out[w] = `${w + padW} × ${bed.len + padL} мм`; });
    out._pad = [padW, padL];
  }
  return out;
}

/* ------------------------------- Работа ------------------------------- */

const dataSrc = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const PRODUCTS = new Function(`${dataSrc}\n return PRODUCTS;`)();

const manifest = fs.existsSync(MANIFEST) && !MODE_FRESH
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : {};

const map = {};
const report = [];
const failed = [];
const dims = {};        // размеры файлов, для отчёта
const sizeMap = {};     // габариты товара со старого сайта
let skipped = 0;

/* Удаляем прежние файлы товара, чтобы нумерация не осталась с дырами */
function wipe(id) {
  if (!fs.existsSync(DIR_P)) return;
  const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(_\\d+)?\\.(jpe?g|png|webp)$`, 'i');
  fs.readdirSync(DIR_P).filter((f) => re.test(f)).forEach((f) => fs.unlinkSync(path.join(DIR_P, f)));
}

async function handleProduct(p) {
  let files = manifest[p.id];
  let html = '';

  /* Страницу читаем всегда (кроме режима --map): по ней доопределяются
     отделки, которые не угадываются по имени файла. Фото при этом
     повторно не качаются, если уже лежат на диске. */
  if (!MODE_MAP) {
    if (!p.old) throw new Error('нет ссылки на старый сайт');
    html = await get(`${SITE}/magazin/product/${p.old}`, true);
    const photos = photosOf(html);
    if (!photos.length) throw new Error('фото на странице не найдены');

    const ready = files && files.length && files.every((f, i) => hasFile(`${p.id}_${i + 1}`));
    if (MODE_FRESH || !ready) {
      wipe(p.id);
      files = [];
      let best = null;                                   // самая крупная из отсеянных
      for (const ph of photos) {
        if (ph.shown <= SWATCH_SHOWN) { skipped++; continue; }   // на странице это квадратик отделки
        let buf;
        try { buf = await get(ph.url); }                 // оригинал
        catch (_) {
          try { buf = await get(ph.thumb); }             // если его нет — превью
          catch (__) { continue; }
        }

        const size = imageSize(buf);
        if (isSwatch(size)) {                            // это квадратик отделки, а не фото
          skipped++;
          const area = size.w * size.h;
          if (!best || area > best.area) best = { ph, buf, size, area };
          continue;
        }
        const ext = path.extname(ph.file) || '.jpg';
        const n = files.length + 1;                      // нумерация без дыр
        try {
          save(path.join(DIR_P, `${p.id}_${n}${ext}`), buf);
          if (n === 1) save(path.join(DIR_P, `${p.id}${ext}`), buf);
          files.push(ph.file);
          dims[ph.file] = size;
        } catch (_) { /* битое фото пропускаем */ }
      }
      /* Совсем без фото товар оставлять нельзя: если крупных картинок
         не нашлось, берём самую большую из отсеянных */
      if (!files.length && best) {
        const ext = path.extname(best.ph.file) || '.jpg';
        save(path.join(DIR_P, `${p.id}_1${ext}`), best.buf);
        save(path.join(DIR_P, `${p.id}${ext}`), best.buf);
        files.push(best.ph.file);
        dims[best.ph.file] = best.size;
        skipped--;
      }
      if (!files.length) throw new Error('подходящих изображений не нашлось');
      manifest[p.id] = files;
    }
  }

  if (!files || !files.length) throw new Error('нет данных о фото — запустите без --map');

  if (html) {
    const d = dimsOf(html);
    if (d) sizeMap[p.id] = d;
  }

  const colors = (p.colors || []).length ? assignColors(p.colors, files, html) : [];

  map[p.id] = { count: files.length, colors };

  const list = files.map((f, i) => {
    const d = dims[f];
    return `     ${String(i + 1).padStart(2)}.  ${f}${d ? `   (${d.w}×${d.h})` : ''}`;
  }).join('\n');
  const pairs = (p.colors || []).length
    ? (p.colors).map((c, i) => {
        const n = colors[i];
        return `     ${String(i + 1).padStart(2)}. ${c.padEnd(38)} → фото ${
          n ? `${n}  (${files[n - 1]})` : '?   ← впишите номер из списка выше'}`;
      }).join('\n')
    : '     (у товара нет вариантов отделки)';

  report.push(
    `${p.title}  [${p.id}]\n` +
    (files.length === 1
      ? '  одно фото — переключать нечего\n'
      : `  фотографий: ${files.length}\n${list}\n`) +
    (files.length === 1 ? '' : '  отделки:\n' + pairs)
  );

  return { count: files.length, guessed: colors.filter(Boolean).length, total: (p.colors || []).length };
}

const hasFile = (name) =>
  ['jpg', 'jpeg', 'png', 'webp'].some((ext) => fs.existsSync(path.join(DIR_P, `${name}.${ext}`)));

/* Перед полной перезакачкой чистим папку: иначе рядом останутся файлы
   от прошлых запусков — со старой схемой имён и с образцами цвета */
function cleanAll() {
  if (!fs.existsSync(DIR_P)) return 0;
  const junk = fs.readdirSync(DIR_P).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  junk.forEach((f) => fs.unlinkSync(path.join(DIR_P, f)));
  return junk.length;
}

async function run() {
  [DIR_P, DIR_I].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  if (!MODE_MAP && (MODE_FRESH || !fs.existsSync(MANIFEST))) {
    const n = cleanAll();
    if (n) console.log(`\nПапка images/products очищена: удалено ${n} файлов от прошлого запуска.`);
  }

  console.log(`\nТоваров в каталоге: ${PRODUCTS.length}${MODE_MAP ? '  (режим: только карта)' : ''}\n`);
  let okCount = 0;
  let photoCount = 0;
  let needHands = 0;

  for (const p of PRODUCTS) {
    try {
      const r = await handleProduct(p);
      okCount++;
      photoCount += r.count;
      let note = 'без отделок';
      if (r.total && r.count > 1) {
        note = `отделки: ${r.guessed} из ${r.total}`;
        if (r.guessed < r.total) { note += '  ← проверьте'; needHands++; }
      } else if (r.count === 1) {
        note = 'одно фото';
      }
      console.log(`  ✓ ${p.id.padEnd(26)} фото: ${String(r.count).padStart(2)}   ${note}`);
    } catch (err) {
      failed.push(p.id);
      console.log(`  ✗ ${p.id.padEnd(26)} ${err.message}`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1), 'utf8');

  const body = Object.entries(map)
    .filter(([, v]) => v.count > 1 && v.colors.length)
    .map(([id, v]) => `  '${id}': { count: ${v.count}, colors: [${v.colors.join(', ')}] },`)
    .join('\n');

  fs.writeFileSync(path.join(ROOT, 'photo-map.js'),
    '/* Соответствие «отделка → фотография».\n' +
    '   Файл создан автоматически: node tools/download-images.js\n\n' +
    '   count  — сколько фото у товара: images/products/<id>_1.jpg … _N.jpg\n' +
    '   colors — номер фото для каждой отделки, по порядку из data.js.\n' +
    '            0 — не распозналось: показывается основное фото товара.\n' +
    '            Верный номер подскажет images/products/ФОТО-ПО-ОТДЕЛКАМ.txt —\n' +
    '            там рядом с номером указано имя файла со старого сайта. */\n\n' +
    'window.PHOTO_MAP = {\n' + body + '\n};\n', 'utf8');

  const dimsBody = Object.entries(sizeMap)
    .map(([id, m]) => {
      const inner = Object.entries(m)
        .filter(([k]) => k !== '_pad')
        .map(([w, v]) => `'${w}': '${v}'`)
        .join(', ');
      return `  '${id}': { ${inner} },`;
    })
    .join('\n');

  fs.writeFileSync(path.join(ROOT, 'dims-map.js'),
    '/* Габаритные размеры кроватей, снятые со старого сайта.\n' +
    '   Файл создан автоматически: node tools/download-images.js\n\n' +
    '   Ключ — ширина спального места, значение — габарит целиком.\n' +
    '   Сайт подставляет его под выбранный размер прямо в карточке. */\n\n' +
    'window.DIMS_MAP = {\n' + dimsBody + '\n};\n', 'utf8');

  fs.writeFileSync(path.join(DIR_P, 'ФОТО-ПО-ОТДЕЛКАМ.txt'),
    'Какое фото какой отделке соответствует\n' +
    '======================================\n\n' +
    'Для каждого товара сначала идёт список его фотографий: номер и имя файла,\n' +
    'под которым фото лежало на старом сайте. Ниже — отделки и номер фото.\n\n' +
    'Где стоит «?», сайт показывает основное фото товара. Чтобы это исправить,\n' +
    'найдите нужный номер в списке выше и впишите его в photo-map.js\n' +
    'в корне сайта. Ошибиться нельзя: неверный номер просто вернёт основное фото.\n\n' +
    'Файлы лежат в images/products как <id>_1.jpg, <id>_2.jpg и так далее.\n\n' +
    report.join('\n\n') + '\n', 'utf8');

  if (!MODE_MAP) {
    console.log('\nИнтерьеры:\n');
    for (let i = 0; i < INTERIOR_SRC.length; i++) {
      const name = `interior-${String(i + 1).padStart(2, '0')}`;
      if (fs.existsSync(path.join(DIR_I, name + '.jpg'))) { console.log(`  ✓ ${name}.jpg уже есть`); continue; }
      try {
        save(path.join(DIR_I, name + '.jpg'), await get(`${SITE}/d/${INTERIOR_SRC[i]}`));
        console.log(`  ✓ ${name}.jpg`);
      } catch (err) {
        console.log(`  ✗ ${name}.jpg ${err.message}`);
      }
    }
    try {
      save(path.join(ROOT, 'images', 'logo.png'), await get(`${SITE}/d/darina_mebel_logo.png`));
      console.log('\n  ✓ logo.png');
    } catch (_) {
      console.log('\n  ✗ logo.png — скачайте логотип вручную');
    }
  }

  console.log(`\nГотово. Товаров: ${okCount} из ${PRODUCTS.length}, фотографий: ${photoCount}.`);
  if (skipped) console.log(`Отсеяно образцов цвета (мелкие квадратики, не фото): ${skipped}.`);
  console.log('Карта отделок записана в photo-map.js');
  console.log(`Габариты сняты у ${Object.keys(sizeMap).length} товаров → dims-map.js`);
  if (needHands) {
    console.log(`\nУ ${needHands} товаров часть отделок не распозналась.`);
    console.log('Откройте images/products/ФОТО-ПО-ОТДЕЛКАМ.txt — там рядом с каждым');
    console.log('номером указано имя файла, так что нужный номер видно сразу.');
  }
  if (failed.length) {
    console.log('\nБез фото остались:');
    failed.forEach((id) => console.log(`   images/products/${id}.jpg`));
  }
  console.log('');
}

run().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
