# Thomson’s Falls 3D Field Explorer

An interactive, metre-scale WebGL reconstruction of Thomson’s Falls in Nyahururu, Kenya.

## Open the explorer

The GitHub Pages build is available at:

<https://sinjy-b.github.io/Render/>

## Controls

- **Fly:** drag to look, `W A S D` to move, `R/F` to change altitude and `Shift` to boost.
- **Walk:** drag to look and use `W A S D`; the camera follows the terrain surface.
- **Weather:** choose sun, mist, rain or fog and adjust atmospheric intensity and sun angle.
- **Soundscape:** enable procedural waterfall, rain and forest ambience from the control panel.

## Data and modelling notes

- The scene covers 640 × 640 m centred at approximately 0.04413° N, 36.37047° E.
- Regional relief is sampled from public Terrarium elevation tiles containing SRTM-derived terrain.
- Esri World Imagery supplies the georeferenced surface texture and an RGB green-cover proxy for vegetation placement.
- One world unit equals one metre. A 74 m waterfall drop is imposed locally because a 30 m-class global DEM cannot resolve the narrow cliff face reliably.
- Fine-scale rocks, vegetation and visitor infrastructure are visual reconstructions rather than survey observations.
- Snow is omitted because the reported 2017 Nyahururu event was identified as hail by the Kenya Meteorological Department.

## Local preview

Serve the repository over HTTP because the module and binary elevation grid do not load through `file://`:

```bash
python -m http.server 4173
```

Then open <http://127.0.0.1:4173>.

## Sources

- NASA Earthdata — SRTMGL1 v003: <https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003>
- Esri — World Imagery: <https://doc.arcgis.com/en/data-appliance/latest/imagery-elevation/world-imagery.htm>
- AFP / Kenya Meteorological Department hail clarification: <https://factcheck.afp.com/images-claiming-show-recent-snowfall-kenya-are-old-and-actually-depict-hail>

The older GeoTIFF exports remain under `data/earth_engine_outputs/` for provenance, but are not used by the current browser build because their stored bounds do not cover the verified falls coordinate.
