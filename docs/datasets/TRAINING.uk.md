# Як тренувати модель розпізнавання (самостійно)

Цикл щоразу однаковий: **фото → стиснути → mapping → рецепт → `npm run lab` → звіт → увімкнути в застосунку**.
Усі команди виконуються з кореня `AI-Agronom-BackEnd`. Технічні подробиці англійською: [README.md](README.md).

## 0. Налаштування (один раз)

У `.env`:

```
SIMILARITY_DATASETS_DIR=C:/ap-scout-data/datasets   # фото (поза OneDrive!)
SIMILARITY_LAB_DIR=C:/ap-scout-data/lab             # кеш векторів, звіти, історія запусків
SIMILARITY_EMBEDDER_DEVICE=dml                      # рахувати на відеокарті
SIMILARITY_EMBEDDER_GPU_ID=1                        # 1 = NVIDIA, 0 = вбудована Intel
```

## 1. Додати фото

Головне правило: **кожен клас — окрема папка**, назва папки = назва класу.

```
my-dataset/
  Septoria/    1.jpg 2.jpg ...
  YellowRust/  ...
  Healthy/     ...
```

**Готовий датасет з інтернету** — розпакувати в тимчасову папку, потім стиснути в робочу:

```
npm run shrink:dataset -- --from D:/temp/my-dataset --to C:/ap-scout-data/datasets/my-dataset --max-per-class 800
```

`--labels "Septoria,Healthy"` — взяти лише потрібні класи. Після цього архів і тимчасову папку можна видалити:
фото стискаються до 512 пікселів, модель усе одно дивиться на 224.

**Шкідники з iNaturalist** (лише фото з вільною ліцензією, авторство пишеться в `credits.csv`):

```
npm run fetch:gbif -- --taxon 1048319 --label Oulema_melanopus --out C:/ap-scout-data/datasets/gbif --max 500
```

Ключ виду: gbif.org → пошук виду → число в адресі сторінки.

**Власні фото з полів** — найцінніші. Розкласти по папках класів і стиснути, як вище. Навіть 50–100 фото на
хворобу помітно піднімають якість на реальних знімках.

Перед використанням датасету в комерційному продукті перевірте ліцензію (CC0 / CC BY — можна; NC — ні).

## 2. Mapping: що є що

Файл `docs/datasets/my-dataset.mapping.json`:

```json
{
  "source": "my-dataset",
  "attribution": "Звідки фото і ліцензія",
  "classes": {
    "Septoria":   { "diagnosisCode": "septoria_leaf_blotch", "cropCode": "wheat_winter" },
    "YellowRust": { "diagnosisCode": "wheat_yellow_rust",    "cropCode": "wheat_winter" },
    "Healthy":    { "diagnosisCode": "healthy_plant",         "cropCode": "wheat_winter" }
  }
}
```

Ліворуч — назва папки, праворуч — код із каталогу (`src/modules/catalog/seed/seed-diagnoses.ts`). Папки без
mapping пропускаються. Нової хвороби немає в каталозі — спершу додати її туди.

## 3. Рецепт

`docs/datasets/experiments/dinov2-base.json` — дописати в `datasets`:

```json
{ "folder": "my-dataset", "mapping": "docs/datasets/my-dataset.mapping.json" }
```

Там же: `epochs` (скільки проходів по фото), `learningRate` (сила виправлення за прохід), `testFraction`
(частка фото на перевірку, 0.2 = 20%). Щоб порівняти варіанти — скопіюйте рецепт під іншою назвою (`name`).

## 4. Тренування

```
npm run lab -- --experiment docs/datasets/experiments/dinov2-base.json
```

Нові фото проходять через відеокарту, старі беруться з кешу. У консолі видно прогрес:
`epoch 60/300: loss 0.07, test accuracy 92%`. Наприкінці — шлях до HTML-звіту.

## 5. Звіт

Відкрити `C:\ap-scout-data\lab\reports\<дата>-<назва>.html` у браузері:

- **Точність / топ-3** — головні цифри.
- **Крива навчання** — помилка має падати, точність рости. Точність почала падати — перенавчання: менше епох
  або більший `l2`.
- **Таблиця класів** — найслабші зверху; їм потрібні нові фото.
- **Таблиця плутанини** — з чим модель плутає.
- **По джерелах** — низька точність на одному датасеті означає, що його фото зняті інакше (фон, масштаб).
- **Усі запуски** — стало краще чи гірше, ніж минулого разу.

## 6. Увімкнути в застосунку

```
npm run lab -- --experiment docs/datasets/experiments/dinov2-base.json --save-classifier
```

У `.env` (модель і колекція мають збігатися з рецептом):

```
SIMILARITY_EMBEDDER_MODEL=onnx-community/dinov2-base
SIMILARITY_EMBEDDER_DTYPE=fp16
QDRANT_COLLECTION=crop_references_dinov2
```

Заповнити Qdrant (для показу схожих фото агроному) — для кожного датасету:

```
npm run index:references -- --dataset C:/ap-scout-data/datasets/my-dataset --mapping docs/datasets/my-dataset.mapping.json
```

Перезапустити бекенд.

## Що можна видаляти

| Що | Можна видалити? |
|---|---|
| Архіви, тимчасові папки | Так, одразу після `shrink:dataset` |
| Стиснуті фото `C:/ap-scout-data/datasets` | Так, якщо не міняти модель-основу: `npm run lab` тренує з кешу векторів. Але зникнуть приклади схожих фото в застосунку |
| Кеш векторів `C:/ap-scout-data/lab/embeddings` | Ні — це «ознаки» всіх фото, з них модель перенавчається без фото |
| `data/models` (ваги DINOv2, класифікатор) | Ні — без них розпізнавання не працює |
