// -------------------------
// Cesium ion initialization
// -------------------------

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2ViY2FjNi1iYjM5LTQ5ZmQtODM3Mi03NWExNmY1ZTdjMGEiLCJpZCI6NDUyMjY4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODMxMDkyNTV9.BakumX90X00ws8_lPAKPLA2Bb7CExV1BTpBgFJjhqqM";

// Your site-specific assets
const THOMSON_TERRAIN_ASSET_ID = 5018338;
const THOMSON_IMAGERY_ASSET_ID = 5018470;

// Global assets (Cesium ion)
const SENTINEL_GLOBAL_ASSET_ID = 3954;          // Sentinel-2 cloudless [web:185]
const OSM_BUILDINGS_ASSET_ID = 96188;          // Cesium OSM Buildings example ID [web:402][web:453]

// -------------------------
// Viewer setup: global core
// -------------------------

// For modern CesiumJS, World Terrain is accessed via Cesium.Terrain.fromWorldTerrain.
// We wrap it in a helper so we can swap terrain later if needed. [web:209][web:455][web:456]

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain({
    requestWaterMask: true,
    requestVertexNormals: true
  }), // global terrain [web:209][web:456]
  geocoder: true,           // search box [web:447][web:450][web:454]
  sceneModePicker: true,    // 2D / 3D / Columbus [web:447][web:450]
  baseLayerPicker: false,   // we'll manage imagery ourselves
  timeline: false,
  animation: false
});

// Lighting and depth testing for nicer terrain rendering [web:456][web:455]
viewer.scene.globe.enableLighting = true;
viewer.scene.globe.depthTestAgainstTerrain = true;

// Allow camera to get close to terrain
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 5;
viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

// -------------------------
// Imagery management
// -------------------------

const imageryLayers = viewer.imageryLayers;
let currentImageryLayer = null;

function setImageryFromAsset(assetId) {
  if (currentImageryLayer) {
    imageryLayers.remove(currentImageryLayer);
    currentImageryLayer = null;
  }
  const provider = new Cesium.IonImageryProvider({ assetId });
  currentImageryLayer = imageryLayers.addImageryProvider(provider);
}

// Default: global Sentinel-2 cloudless [web:185]
setImageryFromAsset(SENTINEL_GLOBAL_ASSET_ID);

// -------------------------
// Global buildings (OSM)
// -------------------------

let osmBuildings = null;

function ensureOsmBuildingsLoaded() {
  if (!osmBuildings) {
    osmBuildings = viewer.scene.primitives.add(
      new Cesium.Cesium3DTileset({
        url: Cesium.IonResource.fromAssetId(OSM_BUILDINGS_ASSET_ID)
      })
    );
    osmBuildings.show = true;
  }
}

function toggleBuildings() {
  ensureOsmBuildingsLoaded();
  osmBuildings.show = !osmBuildings.show;
}

// -------------------------
// Thomson's Falls mode
// -------------------------

const thomsonViewpoints = {
  aerial: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.03, 2800),
    heading: Cesium.Math.toRadians(220),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0.0
  },
  rim: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.03, 2400),
    heading: Cesium.Math.toRadians(200),
    pitch: Cesium.Math.toRadians(-20),
    roll: 0.0
  },
  gorgeBase: {
    destination: Cesium.Cartesian3.fromDegrees(36.38, -0.031, 2250),
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-10),
    roll: 0.0
  }
};

function flyToView(view) {
  viewer.camera.flyTo({
    destination: view.destination,
    orientation: {
      heading: view.heading,
      pitch: view.pitch,
      roll: view.roll
    },
    duration: 2.5
  });
}

// Switch terrain and imagery to Thomson's site-specific assets
function activateThomsonMode() {
  // Terrain: Thomson's DEM [web:204][web:456]
  viewer.scene.setTerrain(
    new Cesium.Terrain(
      Cesium.CesiumTerrainProvider.fromIonAssetId(THOMSON_TERRAIN_ASSET_ID, {
        requestWaterMask: true,
        requestVertexNormals: true
      })
    )
  );

  // Imagery: Thomson's site Sentinel [web:212][web:216][web:219]
  setImageryFromAsset(THOMSON_IMAGERY_ASSET_ID);

  // Fly to aerial viewpoint over the falls
  flyToView(thomsonViewpoints.aerial);
}

// Keyboard shortcuts for Thomson's viewpoints
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "t") activateThomsonMode();        // T: Thomson mode
  if (key === "r") flyToView(thomsonViewpoints.rim);
  if (key === "g") flyToView(thomsonViewpoints.gorgeBase);
  if (key === "a") flyToView(thomsonViewpoints.aerial);
});

// -------------------------
// UI wiring
// -------------------------

const imagerySelect = document.getElementById("imagerySelect");
const toggleBuildingsButton = document.getElementById("toggleBuildingsButton");
const goThomsonButton = document.getElementById("goThomsonButton");

imagerySelect.addEventListener("change", () => {
  const val = imagerySelect.value;
  if (val === "sentinel_global") {
    // Global Sentinel-2 cloudless [web:185]
    viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain({
      requestWaterMask: true,
      requestVertexNormals: true
    }));
    setImageryFromAsset(SENTINEL_GLOBAL_ASSET_ID);
  } else if (val === "thomson_site") {
    activateThomsonMode();
  }
});

toggleBuildingsButton.addEventListener("click", () => {
  toggleBuildings();
});

goThomsonButton.addEventListener("click", () => {
  activateThomsonMode();
});

// -------------------------
// Initial global view
// -------------------------

// Start with a global view; user can search or zoom anywhere.
viewer.camera.flyHome(0); // global extent [web:199][web:450]

// Expose viewer for debugging
window.viewer = viewer;