# Reference datasets for be-similarity

be-similarity stores an image embedding (CLIP or DINOv2, `SIMILARITY_EMBEDDER_MODEL`) of each labelled photo in Qdrant. At diagnosis time the scout's photos are
embedded, the nearest labelled photos of the same crop are fetched, and their labels vote alongside the vision
provider (`SIMILARITY_BLEND_WEIGHT`). Images stay on disk; Qdrant holds only vectors and labels.

## Layout

```
data/datasets/            # git-ignored (data/)
  plantvillage/           # unpacked archive, as downloaded
  plantdoc/
  <your-dataset>/
data/models/              # embedder weights, downloaded on first run
docs/datasets/*.mapping.json   # dataset folder label -> catalogue codes (tracked)
```

Datasets must be folder-per-class: each image's parent folder name is its label. Labels not listed in the
mapping are skipped. CSV-labelled datasets have to be sorted into class folders first.

Keep datasets outside OneDrive/Dropbox folders (`SIMILARITY_DATASETS_DIR`, e.g. `C:/ap-scout-data/datasets`):
sync clients upload every photo.

## Getting photos

Downloaded archives are shrunk before use: models look at 224 px, so a 512 px JPEG copy loses nothing and is
5-20x smaller. The originals and archives can then be deleted.

```
npm run shrink:dataset -- --from <unpacked folder> --to C:/ap-scout-data/datasets/<name> [--labels "A,B"] [--max-per-class 800]
npm run fetch:gbif -- --taxon <GBIF taxon key> --label <class folder> --out C:/ap-scout-data/datasets/gbif --max 500
```

`fetch:gbif` downloads research-grade iNaturalist photos of one species and keeps only CC0 / CC BY ones; the
credit of each photo goes to `credits.csv` beside them. Taxon keys: Oulema melanopus 1048319, Ostrinia nubilalis
8223165, Diabrotica virgifera 1048497, Brassicogethes aeneus 4452928, Psylliodes chrysocephala 1048471.

## Training lab

```
npm run lab -- --experiment docs/datasets/experiments/dinov2-base.json [--save-classifier]
```

A recipe in `docs/datasets/experiments/` names the embedder, the datasets and the classifier settings. The lab
embeds every photo once (on the GPU with `SIMILARITY_EMBEDDER_DEVICE=dml`; on laptops the discrete card is usually
`SIMILARITY_EMBEDDER_GPU_ID=1`) into `SIMILARITY_LAB_DIR/embeddings`, trains the classifier while printing loss and
test accuracy, and writes an HTML report (accuracy, top-3, per-class scores, confusion matrix, most confident
mistakes, all past runs) to `SIMILARITY_LAB_DIR/reports`.

Test photos are a dataset's own `test`/`valid` folders, otherwise a stable `testFraction` share chosen by a hash
of the path. The embedding cache outlives the photos: with the photos deleted, the lab trains from the cache.
`--save-classifier` refits on all photos and writes `SIMILARITY_CLASSIFIER_PATH` for the app; set
`SIMILARITY_EMBEDDER_MODEL`/`DTYPE` to the recipe's, and index Qdrant with the same embedder into a new collection.

## Mapping file

```json
{
  "source": "plantvillage",
  "classes": {
    "Corn_(maize)___Northern_Leaf_Blight": { "diagnosisCode": "northern_leaf_blight_maize", "cropCode": "maize" }
  }
}
```

`attribution` (optional) is the credit shown under the dataset's photos when they are offered for comparison.
Index datasets from below `SIMILARITY_DATASETS_DIR` (default `data/datasets`), otherwise their photos cannot be shown.

`diagnosisCode` and `cropCode` must be catalogue codes (`src/modules/catalog/seed/`). The indexer warns about
unknown ones. `source` is part of each point id, so re-indexing the same files updates points instead of duplicating.

## Indexing

```
npm run index:references -- --dataset data/datasets/plantvillage/color --mapping docs/datasets/plantvillage.mapping.json --dry-run
npm run index:references -- --dataset data/datasets/plantvillage/color --mapping docs/datasets/plantvillage.mapping.json --max-per-class 500
```

`--dry-run` lists every label found, with its image count and mapping, without touching Qdrant. Run it first and
fill the mapping from its output. `--max-per-class` keeps large classes from drowning small ones in the vote.
Point PlantVillage at one variant folder (`color`), not the root: the archive also holds `grayscale` and
`segmented` copies of the same photos.

## Training the classifier

```
npm run train:classifier
```

Pulls every vector from the collection, reports held-out accuracy, then fits a softmax probe on all of them
and writes `SIMILARITY_CLASSIFIER_PATH`. Recognition then takes its vote from the probe instead of the raw
neighbours. Re-run after indexing new photos and restart the backend.

Changing `SIMILARITY_EMBEDDER_MODEL` or `SIMILARITY_EMBEDDER_DTYPE` produces incompatible vectors: use a new
`QDRANT_COLLECTION` and re-index.

## Sources

| Dataset | Where | Catalogue coverage | Notes |
|---|---|---|---|
| PlantVillage | Kaggle `abdallahalidev/plantvillage-dataset`; GitHub `spMohanty/PlantVillage-Dataset` | maize northern leaf blight, healthy maize/soybean | lab photos on plain background |
| PlantDoc | GitHub `pratikkayal/PlantDoc-Dataset` | maize leaf blight, healthy soybean | field photos, small |
| Wheat Plant Diseases | Kaggle `kushagra3204/wheat-plant-diseases` (CC0) | wheat yellow/leaf rust, septoria, powdery mildew, fusarium head blight, cereal aphids, healthy | field photos; index `data/train`, keep `test`/`valid` for tuning |
| Wheat Leaf Dataset | Mendeley Data `wgd66f8n6h` (CC BY 4.0), one RAR | healthy leaf, stripe (yellow) rust, septoria | field close-ups of single leaves, Ethiopia; the only source of healthy-leaf close-ups |
| JIC wheat (Long 2023) | Zenodo `7573133` (CC BY 4.0) | yellow/brown rust, septoria, mildew, healthy | field and glasshouse; flat files named by class, sort into folders |
| Sunflower Leaf Disease | Mendeley Data `c5mxmfmprt` (CC BY 4.0) | sunflower downy mildew, healthy | field, Bangladesh |
| ASDID soybean | Zenodo `7304859` (CC0) | soybean downy mildew, healthy | one zip per class (`downey_mildew.zip`, `unused_healthy.zip`) |
| iNaturalist via GBIF | `npm run fetch:gbif` (CC0 / CC BY only) | cereal leaf beetle, corn borer, rootworm, pollen beetle, flea beetle | adult insects, field |
| INRAE field leaf fragments | Recherche Data Gouv `10.57745/VYR8ZF`, `A6RPFO`, `0U7D1V` (CC BY-NC) | wheat diseases, sunflower phomopsis, rapeseed phoma/alternaria | best field data, but non-commercial |
| IP102 | GitHub `xpwu95/IP102` | aphids, corn borer, pollen beetle, ... | pests; labelled by class id, needs sorting into folders |

Check each dataset's licence before use in a commercial product. Expert-confirmed photos from the app are the most
valuable references; public sets are a starting point.
