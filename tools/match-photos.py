#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сопоставление «отделка → фотография» по именам файлов со старого сайта.

Идея: имя файла почти всегда содержит название цвета — krovat_shokolad.jpg,
viva_slonovaya_kost.jpg, oreh_tumba.jpg. Приводим и название отделки, и имя
файла к латинице, режем на слова, отбрасываем служебные («krovat», «jpeg»,
«whatsapp») и сравниваем основы слов, чтобы «Серый» совпал с «seraya»,
а «Лиловый» — с «lilovaya».
"""

import json, io, os, re, difflib
from collections import defaultdict

import sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'images', 'products', '_sources.json')

RU = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i',
    'й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
    'у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
    'э':'e','ю':'yu','я':'ya',
}

# Слова, которые есть в именах файлов у всех подряд и цвет не обозначают
JUNK = {
    'krovat','krovati','tumba','tumby','komod','shkaf','shkafy','stellazh','polka',
    'spalnya','spalni','matras','stol','stul','taburet','mebel','divan','kresl',
    'jpeg','jpg','png','webp','image','images','whatsapp','at','photo','foto','img',
    'interer','interier','inter','px','new','copy','final','var','variant','fasad',
    'korpus','obshij','obshaya','vid','front','main','glavn','navesnaya','prikrovatnaya',
    'yarus','yar','dvuh','odno','sht','mm','sm','razmer','tv',
}

# Слова отделки, которые сами по себе ничего не различают
STOP = {'vstavka','velyur','tkan','nozhki','stoleshnica','beton','lajt','lait','cvet'}

# Фабрика называет один и тот же цвет по-разному: в каталоге «Голубой лён»,
# а файл — sleep_sinij. Такие пары засчитываем, но с меньшей уверенностью,
# чтобы точное совпадение всегда выигрывало.
SYNONYMS = {
    'goluboj': ['sinij'],
    'sinij': ['goluboj'],
    'kapuchino': ['korichnevyj'],
    'korichnevyj': ['kapuchino'],
}
SYN_SCORE = 0.72


def translit(text):
    return ''.join(RU.get(ch, ch) for ch in text.lower())


def words(text):
    """Латинские слова длиной от 3 букв."""
    return [w for w in re.split(r'[^a-z]+', translit(text)) if len(w) >= 3]


def stem(w):
    """Грубая основа: срезаем окончания прилагательных, оставляя минимум 3 буквы."""
    for suf in ('yaya','aya','oye','ogo','ego','omu','ymi','imi','yh','ih','yj','ij',
                'oj','iy','yy','ye','ie','oe','ym','im','om','yu','ya','y','j','a','o','e','i'):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[:-len(suf)]
    return w


def sim(a, b):
    """Похожесть двух слов: по общей основе, общему началу и списку синонимов."""
    if a == b:
        return 1.0
    sa, sb = stem(a), stem(b)
    if sa == sb:
        return 0.95
    for syn in SYNONYMS.get(a, []):
        if stem(syn) == sb:
            return SYN_SCORE
    for syn in SYNONYMS.get(b, []):
        if stem(syn) == sa:
            return SYN_SCORE
    # общее начало
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    pref = (2.0 * n) / (len(a) + len(b)) if n >= 3 else 0.0
    return max(pref, difflib.SequenceMatcher(None, a, b).ratio() if n >= 3 else 0.0)


def parts_of(name):
    """Название отделки → (слова основного цвета, слова уточнения после слэша)."""
    chunks = name.split('/')
    main = [w for w in words(chunks[0]) if w not in STOP]
    rest = [w for c in chunks[1:] for w in words(c) if w not in STOP]
    return main, rest


def shared_terms(colors):
    """
    Слова, по которым отделки товара не различить.

    Роль слова важна. У «Мэтро» есть отделки «Шоколад / Вставка бежевый»
    и просто «Бежевый». Слово «бежевый» — имя второй отделки целиком, значит
    файл metro_bezhevyj.jpg принадлежит именно ей; для первой это лишь вставка.
    Поэтому обесцениваем слово только там, где оно и правда не различает.
    """
    main_seen, main_dup = set(), set()
    rest_seen, rest_dup = set(), set()
    for c in colors:
        main, rest = parts_of(c)
        for w in set(main):
            if w in main_seen:
                main_dup.add(w)
            main_seen.add(w)
        for w in set(rest):
            if w in rest_seen:
                rest_dup.add(w)
            rest_seen.add(w)
    return main_dup, rest_dup, main_seen


def color_terms(name, shared=(frozenset(), frozenset(), frozenset())):
    main_dup, rest_dup, main_seen = shared
    main, rest = parts_of(name)
    out = []
    for w in main:
        out.append((w, 0.25 if w in main_dup else 1.0))
    for w in rest:
        weak = w in rest_dup or w in main_seen   # у кого-то это слово — имя цвета
        out.append((w, 0.85 * (0.25 if weak else 1.0)))
    return out


def file_terms(fname):
    base = os.path.splitext(fname)[0]
    return [w for w in words(base) if w not in JUNK and not w.isdigit()]


def score(color, fname, shared=(frozenset(), frozenset(), frozenset())):
    """
    Насколько имя файла похоже на название отделки: 0 … 1.

    Считаем по лучшему совпавшему слову, а не по среднему: файл
    sleep_belyj_1.jpg — верное фото для отделки «Белый лотос», хотя слова
    «лотос» в имени нет. Совпадение остальных слов лишь добавляет уверенности.
    """
    cterms = color_terms(color, shared)
    fterms = file_terms(fname)
    if not cterms or not fterms:
        return 0.0

    hits = []
    for cw, weight in cterms:
        best = max((sim(cw, fw) for fw in fterms), default=0.0)
        if best >= 0.6:
            hits.append(best * weight)
    if not hits:
        return 0.0

    hits.sort(reverse=True)
    # лучшее слово задаёт оценку, каждое следующее добавляет уверенности
    return hits[0] + 0.06 * (len(hits) - 1)


THRESHOLD = 0.55

def own_bonus(pid, fname):
    """Файл, в имени которого есть название товара, — это его собственный
    кадр, а не общий интерьер. Немного повышаем ему приоритет."""
    key = re.split(r'[^a-z]+', pid)[0]
    return 0.05 if len(key) >= 4 and key in translit(fname) else 0.0


def assign(colors, files, pid=''):
    """
    Раздаём фото по отделкам: сначала самые уверенные совпадения.
    Один файл — одной отделке, чтобы у разных цветов не оказалось одно фото.
    """
    shared = shared_terms(colors)
    pairs = []
    for ci, c in enumerate(colors):
        for fi, f in enumerate(files):
            s = score(c, f, shared)
            if s >= THRESHOLD:
                pairs.append((s + own_bonus(pid, f), ci, fi))
    pairs.sort(key=lambda x: (-x[0], x[1], x[2]))

    res = [0] * len(colors)
    used = set()
    detail = [None] * len(colors)
    for s, ci, fi in pairs:
        if res[ci] or fi in used:
            continue
        res[ci] = fi + 1
        used.add(fi)
        detail[ci] = (files[fi], s)
    return res, detail


def load_products():
    """Читаем id, название и отделки прямо из data.js — без Node."""
    src = io.open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    out = []
    for m in re.finditer(r"id:\s*'([^']+)'[\s\S]*?title:\s*'([^']*)'", src):
        pid, title = m.group(1), m.group(2)
        tail = src[m.end():m.end() + 1200]
        cm = re.search(r"colors:\s*\[([^\]]*)\]", tail)
        colors = re.findall(r"'([^']*)'", cm.group(1)) if cm else []
        out.append({'id': pid, 'title': title, 'colors': colors})
    return out


NAMES = os.path.join(ROOT, 'photo-map-names.json')
DIR_P = os.path.join(ROOT, 'images', 'products')

try:                                   # подбор по оттенку — необязательная часть
    import numpy as _np
    from PIL import Image as _Image
    TONE_OK = True
except ImportError:
    TONE_OK = False


# ------------------ Доопределение по оттенку самой фотографии ------------------
# Часть снимков названа безлико, и по имени цвет не выяснить. Тогда смотрим,
# какого оттенка предмет на фото: холодного, тёплого или нейтрального, — и
# сравниваем с образцом цвета отделки из FINISHES. Привязываем только когда
# кандидат ровно один и на него не претендует другая отделка: ошибиться здесь
# хуже, чем оставить основное фото.

def _finishes():
    src = io.open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    m = re.search(r'const FINISHES = \{([\s\S]*?)\n\};', src)
    if not m:
        return {}
    out = {}
    for k, v in re.findall(r"'([^']+)':\s*'(#[0-9A-Fa-f]{6})'", m.group(1)):
        out[k.lower()] = tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
    return out


def _family(rgb):
    r, g, b = rgb[0], rgb[1], rgb[2]
    if b - r > 14:
        return 'cold'
    if r - b > 14:
        return 'warm'
    return 'neutral'


def by_tone(pid, colors, files, res, np, Image):
    """Возвращает список (индекс отделки, номер фото) для однозначных случаев."""
    fin = _finishes()
    if not fin:
        return []

    def photo_tone(n):
        path = None
        for e in ('jpg', 'jpeg', 'png', 'webp'):
            cand = os.path.join(DIR_P, f'{pid}_{n}.{e}')
            if os.path.exists(cand):
                path = cand
                break
        if not path:
            return None
        try:
            im = Image.open(path).convert('RGB')
            im.thumbnail((160, 160))
        except Exception:
            return None
        a = np.asarray(im).astype('float32')
        L = a[:, :, 0] * .299 + a[:, :, 1] * .587 + a[:, :, 2] * .114
        body = (L > 40) & (L < 232)
        if body.sum() < 200:
            return None

        # Чертёж в подборе цвета не участвует. Отличаем его так же, как в
        # sort-photos.py: у контурного рисунка почти вся линия граничит с белым,
        # а у снимка предмета — только край. Проверять «много белого» нельзя:
        # серый шкаф на белом фоне тоже почти весь белый.
        white = L > 238
        ink = ~white
        if ink.sum() > 40:
            nb = np.zeros_like(white)
            nb[1:, :] |= white[:-1, :]; nb[:-1, :] |= white[1:, :]
            nb[:, 1:] |= white[:, :-1]; nb[:, :-1] |= white[:, 1:]
            thin = float((ink & nb).sum() / ink.sum())
            mx, mn = a.max(2), a.min(2)
            sat = float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean())
            if thin > 0.45 and sat < 0.02:
                return None

        return _family(a[body].mean(0))

    used = {n for n in res if n}
    free = [n for n in range(1, len(files) + 1) if n not in used]
    tones = {n: photo_tone(n) for n in free}

    claims = {}
    for i, c in enumerate(colors):
        if res[i]:
            continue
        sw = fin.get(c.split('/')[0].strip().lower())
        if not sw:
            continue
        want = _family(sw)
        cand = [n for n, t in tones.items() if t == want]
        if len(cand) == 1:
            claims.setdefault(cand[0], []).append(i)

    return [(idx[0], n) for n, idx in claims.items() if len(idx) == 1]


def load_remembered():
    """
    Ранее заданные привязки «отделка → имя файла».

    Часть фотографий названа безлико (whatsapp_image_...), по имени цвет
    у них не определить. Но если привязка уже была задана — руками или
    прошлым разбором, — её нельзя терять при пересборке. Храним именно
    имя файла, поэтому удаление и перенумерация снимков ей не вредят.
    """
    if not os.path.exists(NAMES):
        return {}
    try:
        return json.load(io.open(NAMES, encoding='utf-8'))
    except Exception:
        return {}


def main():
    products = load_products()
    remembered = load_remembered()
    sources = json.load(io.open(SRC, encoding='utf-8'))

    pdir = os.path.join(ROOT, 'images', 'products')
    on_disk = defaultdict(int)
    for f in os.listdir(pdir):
        m = re.match(r'^(.+)_(\d+)\.(jpe?g|png|webp)$', f, re.I)
        if m:
            on_disk[m.group(1)] = max(on_disk[m.group(1)], int(m.group(2)))

    out_lines, report, stats = [], [], {'matched': 0, 'total': 0, 'noinfo': []}
    results = {}          # pid → (отделки, номера фото, имена файлов)

    for p in products:
        pid, colors = p['id'], p['colors']
        files = sources.get(pid, [])
        count = on_disk.get(pid, len(files))
        if not files or not colors:
            continue

        res, detail = assign(colors, files, pid)

        # чего не дало сравнение имён — берём из запомненного
        known = remembered.get(pid, {})
        used = {n for n in res if n}
        for i, c in enumerate(colors):
            if res[i] or c not in known:
                continue
            fname = known[c]
            if fname in files:
                n = files.index(fname) + 1
                if n not in used:
                    res[i] = n
                    used.add(n)
                    detail[i] = (fname, -1.0)      # -1 = взято из памяти

        if TONE_OK and any(n == 0 for n in res):
            for ci, n in by_tone(pid, colors, files, res, _np, _Image):
                res[ci] = n
                detail[ci] = (files[n - 1], -2.0)   # -2 = подобрано по оттенку
        # номер не должен выходить за число реально лежащих файлов
        res = [n if n <= count else 0 for n in res]

        stats['total'] += len(colors)
        stats['matched'] += sum(1 for n in res if n)
        if not any(res):
            stats['noinfo'].append((pid, p['title'], len(colors)))

        results[pid] = (colors, res, files)
        out_lines.append("  '%s': { count: %d, colors: [%s] }," % (pid, count, ', '.join(map(str, res))))

        block = ['%s  [%s]' % (p['title'], pid), '  фотографии:']
        for i, f in enumerate(files[:count], 1):
            block.append('    %2d. %s' % (i, f))
        block.append('  отделки:')
        for i, c in enumerate(colors):
            if res[i]:
                f, s = detail[i]
                if s == -2.0:
                    block.append('    %2d. %-38s → фото %-2d  %s  (по оттенку, проверьте)' % (i + 1, c, res[i], f))
                elif s < 0:
                    block.append('    %2d. %-38s → фото %-2d  %s  (задано ранее)' % (i + 1, c, res[i], f))
                else:
                    block.append('    %2d. %-38s → фото %-2d  %s  (совпадение %.0f%%)' % (i + 1, c, res[i], f, min(s, 1.0) * 100))
            else:
                block.append('    %2d. %-38s → основное фото  (в именах файлов цвет не указан)' % (i + 1, c))
        report.append('\n'.join(block))

    header = (
        '/* Соответствие «отделка → фотография».\n'
        '   Номера расставлены по названиям файлов со старого сайта:\n'
        '   krovat_shokolad.jpg → отделка «Шоколад», viva_slonovaya_kost.jpg →\n'
        '   «Слоновая кость». Один файл достаётся только одной отделке.\n\n'
        '   count  — сколько фото у товара: images/products/<id>_1.jpg … _N.jpg\n'
        '   colors — номер фото для каждой отделки, по порядку из data.js.\n'
        '            0 — в имени файла цвета нет, показывается основное фото.\n'
        '            Что чему соответствует, видно в\n'
        '            images/products/ФОТО-ПО-ОТДЕЛКАМ.txt */\n\n'
        'window.PHOTO_MAP = {\n'
    )
    io.open(os.path.join(ROOT, 'photo-map.js'), 'w', encoding='utf-8').write(
        header + '\n'.join(out_lines) + '\n};\n')

    # запоминаем итог именами файлов — переживёт любую перенумерацию
    keep = {}
    for pid, (colors, res, files) in results.items():
        names = {colors[i]: files[n - 1]
                 for i, n in enumerate(res) if n and n <= len(files) and i < len(colors)}
        if names:
            keep[pid] = names
    json.dump(keep, io.open(NAMES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    io.open(os.path.join(pdir, 'ФОТО-ПО-ОТДЕЛКАМ.txt'), 'w', encoding='utf-8').write(
        'Какое фото какой отделке соответствует\n'
        '======================================\n\n'
        'Номера расставлены автоматически по названиям файлов со старого сайта.\n'
        'Где написано «основное фото» — в имени файла цвета нет, подобрать было\n'
        'не по чему. Впишите номер вручную в photo-map.js, если знаете нужный.\n\n'
        + '\n\n'.join(report) + '\n')

    print('Отделок всего: %d, сопоставлено: %d (%.0f%%)'
          % (stats['total'], stats['matched'], 100.0 * stats['matched'] / stats['total']))
    print('\nТовары, где в именах файлов цвета нет вообще:')
    for pid, title, n in stats['noinfo']:
        print('   %-26s %s — отделок %d' % (pid, title, n))


main()
