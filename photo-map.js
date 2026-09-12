/* Соответствие «отделка → фотография».
   Номера расставлены по названиям файлов со старого сайта:
   krovat_shokolad.jpg → отделка «Шоколад», viva_slonovaya_kost.jpg →
   «Слоновая кость». Один файл достаётся только одной отделке.

   count  — сколько фото у товара: images/products/<id>_1.jpg … _N.jpg
   colors — номер фото для каждой отделки, по порядку из data.js.
            0 — в имени файла цвета нет, показывается основное фото.
            Что чему соответствует, видно в
            images/products/ФОТО-ПО-ОТДЕЛКАМ.txt */

window.PHOTO_MAP = {
  'aleksandra': { count: 2, colors: [0, 0] },
  'aleksandra-vstavka': { count: 2, colors: [0, 2] },
  'assol': { count: 5, colors: [4, 1, 3, 2] },
  'veneciya-2': { count: 2, colors: [0, 0] },
  'graciya-2': { count: 1, colors: [0, 0, 0, 0] },
  'eva': { count: 1, colors: [0, 1] },
  'kandi': { count: 6, colors: [5, 4, 2, 3] },
  'kapriz': { count: 6, colors: [2, 1, 4, 6, 5, 3] },
  'katrin': { count: 1, colors: [1, 0] },
  'katrin-2': { count: 1, colors: [1] },
  'katrin-3': { count: 1, colors: [1] },
  'katrin-4': { count: 2, colors: [2, 1] },
  'nimfa': { count: 2, colors: [0, 0] },
  'siesta': { count: 8, colors: [5, 3, 1, 6, 7, 4] },
  'tvist': { count: 5, colors: [3, 5, 1, 2, 4] },
  'rest': { count: 3, colors: [2, 3, 1] },
  'rest-tahta': { count: 3, colors: [3, 2, 1] },
  'fancy': { count: 4, colors: [4, 1, 2, 3] },
  'yuzhanka': { count: 1, colors: [1] },
  'viva': { count: 7, colors: [3, 1, 2, 4, 6] },
  'metro': { count: 10, colors: [1, 2, 9, 6, 3] },
  'sharm-3': { count: 3, colors: [3, 2, 1] },
  'sleep-1': { count: 4, colors: [0, 3, 0, 1, 0, 0] },
  'sleep-2': { count: 5, colors: [1, 4, 2] },
  'nadezhda': { count: 1, colors: [0] },
  'spalnya-aleksandra': { count: 6, colors: [0, 0] },
  'spalnya-veneciya': { count: 5, colors: [0, 0] },
  'spalnya-viva': { count: 11, colors: [0, 0, 0, 0] },
  'spalnya-kapriz': { count: 8, colors: [0, 0, 0, 0, 0, 0] },
  'spalnya-nimfa': { count: 7, colors: [0, 0] },
  'shkaf-veneciya-3': { count: 2, colors: [0, 1] },
  'shkaf-germes-3': { count: 2, colors: [0, 1] },
  'shkaf-lofti-2': { count: 6, colors: [2, 1, 3, 4, 5] },
  'komod-lofti': { count: 8, colors: [1, 7, 5, 6, 4] },
  'komod-1': { count: 1, colors: [0, 1] },
  'komod-2': { count: 1, colors: [0, 1] },
  'komod-4': { count: 2, colors: [1, 2] },
  'tumba-art': { count: 3, colors: [1, 0, 3, 0, 0, 2] },
  'tumba-lofti': { count: 5, colors: [3, 1, 2, 4, 5] },
  'tumba-soft': { count: 1, colors: [0, 0, 0, 0, 1] },
  'tumba-tv-lofti': { count: 5, colors: [5, 0, 0, 3, 4] },
  'tumba-1': { count: 1, colors: [0, 1] },
  'tumba-1-2': { count: 2, colors: [2, 1] },
  'tumba-2': { count: 1, colors: [0, 1] },
  'tumba-4': { count: 2, colors: [1, 2] },
  'gostinaya-lofti': { count: 14, colors: [0, 9, 0, 14, 0] },
  'stellazh-lofti': { count: 7, colors: [1, 2, 3, 4, 5] },
  'stol-grand': { count: 3, colors: [0, 0] },
  'stol-grand-razdvizhnoj': { count: 3, colors: [3, 2] },
  'stul-1': { count: 1, colors: [0, 0, 0] },
  'stul-2': { count: 1, colors: [0, 0, 0] },
  'stul-3': { count: 1, colors: [0, 0, 0] },
  'taburet-tochenyj': { count: 1, colors: [0, 0, 0] },
  'taburet-3': { count: 2, colors: [0, 2, 1] },
};
