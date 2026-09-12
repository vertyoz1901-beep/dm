#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Чертежи и схемы — в конец галереи.

Среди скачанных снимков попадаются технические чертежи: контурный рисунок
тонкими линиями на белом. Как фотография товара он не годится, но как
справка о габаритах полезен, поэтому такие кадры не удаляем, а переносим
в конец ленты.

Запуск из папки проекта:
    python3 tools/sort-photos.py

Отличаем чертёж от фото по трём признакам: доля «чернил», касающихся белого
(у линии почти вся линия, у залитого предмета — только край), насыщенность
и число разных цветов. У чертежей эти значения резко отличаются от фото,
поэтому порог берём с большим запасом.

После запуска стоит пересобрать соответствие отделок:
    python3 tools/match-photos.py
"""
import json, io, os, re, shutil, sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('Нужны numpy и Pillow:  pip install numpy pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'images', 'products')
SRC = os.path.join(DIR, '_sources.json')

THIN_MIN = 0.45     # у чертежей 0.54–0.84, у фотографий не выше 0.24
SAT_MAX = 0.02
COLORS_MAX = 24


def is_drawing(path):
    try:
        im = Image.open(path).convert('RGB')
        im.thumbnail((220, 220))
    except Exception:
        return False
    a = np.asarray(im).astype(np.int32)
    L = (a[:, :, 0] * 299 + a[:, :, 1] * 587 + a[:, :, 2] * 114) // 1000
    mx, mn = a.max(2), a.min(2)
    sat = float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean())
    white = L > 238
    ink = ~white
    if ink.sum() < 40:
        return False

    near_white = np.zeros_like(white)
    near_white[1:, :] |= white[:-1, :]
    near_white[:-1, :] |= white[1:, :]
    near_white[:, 1:] |= white[:, :-1]
    near_white[:, :-1] |= white[:, 1:]
    thin = float((ink & near_white).sum() / ink.sum())

    q = a // 32
    colors = int(len(np.unique((q[:, :, 0] * 36 + q[:, :, 1] * 6 + q[:, :, 2])[ink])))
    return thin > THIN_MIN and sat < SAT_MAX and colors <= COLORS_MAX


def ext_of(pid, n):
    for e in ('jpg', 'jpeg', 'png', 'webp'):
        if os.path.exists(os.path.join(DIR, f'{pid}_{n}.{e}')):
            return e
    return None


def main():
    src = json.load(io.open(SRC, encoding='utf-8'))
    moved = {}

    for pid, files in list(src.items()):
        items = []
        for n in range(1, len(files) + 1):
            e = ext_of(pid, n)
            if not e:
                continue
            items.append({'n': n, 'ext': e, 'name': files[n - 1],
                          'draw': is_drawing(os.path.join(DIR, f'{pid}_{n}.{e}'))})
        if not items or not any(i['draw'] for i in items):
            continue

        order = [i for i in items if not i['draw']] + [i for i in items if i['draw']]
        if [i['n'] for i in order] == [i['n'] for i in items]:
            continue                                  # чертежи и так в конце

        tmp = []
        for i in order:
            t = os.path.join(DIR, f"__s_{pid}_{i['n']}.{i['ext']}")
            shutil.move(os.path.join(DIR, f"{pid}_{i['n']}.{i['ext']}"), t)
            tmp.append((t, i))
        for f in os.listdir(DIR):
            if re.match(r'^%s(_\d+)?\.(jpe?g|png|webp)$' % re.escape(pid), f, re.I):
                os.remove(os.path.join(DIR, f))

        new_names = []
        for k, (t, i) in enumerate(tmp, 1):
            dst = os.path.join(DIR, f"{pid}_{k}.{i['ext']}")
            shutil.move(t, dst)
            if k == 1:
                shutil.copyfile(dst, os.path.join(DIR, f"{pid}.{i['ext']}"))
            new_names.append(i['name'])

        src[pid] = new_names
        moved[pid] = [i['name'] for i in order if i['draw']]

    json.dump(src, io.open(SRC, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    if not moved:
        print('Чертежей, стоящих не в конце, не найдено.')
        return
    print('Перенесено в конец галереи:')
    for pid, names in sorted(moved.items()):
        for nm in names:
            print('  %-24s %s' % (pid, nm))
    print('\nТеперь пересоберите карту отделок:  python3 tools/match-photos.py')


main()
