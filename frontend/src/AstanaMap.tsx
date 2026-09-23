import L, { type GeoJSON as LeafletGeoJSON, type Path } from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";

type District = { id: string; name_ru: string };
type Decision = { initiative_id: string; district_id: string | null };
type Initiative = { id: string; scope: "city" | "district" };

type DistrictProperties = {
  district_id: string;
  name_ru: string;
  quality_status?: string;
};

const SOURCE_TO_MODEL_ID: Record<string, string> = {
  almaty: "almaty",
  baikonyr: "baikonur",
  esil: "yesil",
  nura: "nura",
  saryarka: "saryarka",
};

const DEFAULT_STYLE: L.PathOptions = {
  color: "#287d89",
  weight: 1.5,
  fillColor: "#62c5c4",
  fillOpacity: 0.18,
};
const AFFECTED_STYLE: L.PathOptions = {
  color: "#007c70",
  weight: 2.5,
  fillColor: "#55cdbc",
  fillOpacity: 0.42,
};
const HOVER_STYLE: L.PathOptions = {
  color: "#075d69",
  weight: 2.5,
  fillColor: "#8ddbd3",
  fillOpacity: 0.52,
};
const SELECTED_STYLE: L.PathOptions = {
  color: "#8a5800",
  weight: 3.5,
  fillColor: "#ffd16f",
  fillOpacity: 0.68,
};
const CONTEXT_STYLE: L.PathOptions = {
  color: "#83939b",
  weight: 1.5,
  dashArray: "5 5",
  fillColor: "#b9c4c8",
  fillOpacity: 0.14,
};

function validateGeoJSON(value: unknown): FeatureCollection<Geometry, DistrictProperties> {
  if (!value || typeof value !== "object") throw new Error("Файл границ недоступен.");
  const candidate = value as FeatureCollection<Geometry, DistrictProperties>;
  if (candidate.type !== "FeatureCollection" || !Array.isArray(candidate.features)) {
    throw new Error("Формат границ районов некорректен.");
  }
  if (candidate.features.length < 5) throw new Error("Недостаточно районов для карты.");
  for (const feature of candidate.features) {
    if (!feature.properties?.district_id || !feature.geometry) {
      throw new Error("Геометрия района не связана с каталогом.");
    }
  }
  return candidate;
}

function applyLayerStyles(
  layers: Map<string, Path>,
  selectedDistrictId: string,
  hoveredDistrictId: string | null,
  decisions: Decision[],
  initiatives: Map<string, Initiative>,
) {
  const affectedDistricts = new Set(
    decisions.flatMap((decision) => (decision.district_id ? [decision.district_id] : [])),
  );
  const citywide = decisions.some(
    (decision) => initiatives.get(decision.initiative_id)?.scope === "city",
  );
  for (const [districtId, layer] of layers) {
    const style =
      districtId === selectedDistrictId
        ? SELECTED_STYLE
        : districtId === hoveredDistrictId
          ? HOVER_STYLE
        : citywide || affectedDistricts.has(districtId)
          ? AFFECTED_STYLE
          : DEFAULT_STYLE;
    layer.setStyle(style);
    const label = layer.getTooltip()?.getElement();
    label?.classList.toggle("is-selected", districtId === selectedDistrictId);
    label?.classList.toggle("is-hovered", districtId === hoveredDistrictId);
    if (districtId === selectedDistrictId) {
      layer.bringToFront();
    }
  }
}

export default function AstanaMap({
  districts,
  selectedDistrictId,
  onSelectDistrict,
  decisions,
  initiatives,
}: {
  districts: District[];
  selectedDistrictId: string;
  onSelectDistrict: (id: string) => void;
  decisions: Decision[];
  initiatives: Map<string, Initiative>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<LeafletGeoJSON | null>(null);
  const layersRef = useRef(new Map<string, Path>());
  const selectRef = useRef(onSelectDistrict);
  const selectedRef = useRef(selectedDistrictId);
  const hoveredRef = useRef<string | null>(null);
  const decisionsRef = useRef(decisions);
  const initiativesRef = useRef(initiatives);
  const [status, setStatus] = useState("Загружаем OpenStreetMap и границы районов…");
  const [failed, setFailed] = useState(false);

  selectedRef.current = selectedDistrictId;
  decisionsRef.current = decisions;
  initiativesRef.current = initiatives;

  useEffect(() => {
    selectRef.current = onSelectDistrict;
  }, [onSelectDistrict]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const mapContainer = container;
    const districtLayers = layersRef.current;
    const controller = new AbortController();
    let disposed = false;

    async function mount() {
      try {
        const response = await fetch("/data/astana-districts.geojson", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Не удалось загрузить границы районов.");
        const geojson = validateGeoJSON(await response.json());
        if (disposed) return;

        const map = L.map(mapContainer, {
          scrollWheelZoom: false,
          minZoom: 8,
          maxZoom: 16,
          attributionControl: true,
        });
        map.attributionControl.setPrefix(false);
        mapRef.current = map;

        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        });
        tiles.on("loading", () => setStatus("Загружаем подложку OpenStreetMap…"));
        tiles.on("load", () => setStatus("OpenStreetMap • опубликованные границы районов Астаны"));
        tiles.on("tileerror", () =>
          setStatus("Часть тайлов OSM недоступна; границы и выбор районов продолжают работать."),
        );
        tiles.addTo(map);

        const districtById = new Map(districts.map((district) => [district.id, district]));
        const overlay = L.geoJSON(geojson, {
          style: (feature) => {
            const sourceId = feature?.properties?.district_id as string | undefined;
            return sourceId && SOURCE_TO_MODEL_ID[sourceId] ? DEFAULT_STYLE : CONTEXT_STYLE;
          },
          onEachFeature: (
            feature: Feature<Geometry, DistrictProperties>,
            layer: L.Layer,
          ) => {
            const sourceId = feature.properties.district_id;
            const modelId = SOURCE_TO_MODEL_ID[sourceId];
            const displayName = districtById.get(modelId)?.name_ru ?? feature.properties.name_ru;
            layer.bindTooltip(displayName, {
              permanent: true,
              direction: "center",
              className: `district-map-label${modelId ? "" : " is-context"}`,
              opacity: 1,
            });
            if (layer instanceof L.Path && modelId) {
              districtLayers.set(modelId, layer);
              const refresh = () =>
                applyLayerStyles(
                  districtLayers,
                  selectedRef.current,
                  hoveredRef.current,
                  decisionsRef.current,
                  initiativesRef.current,
                );
              layer.on({
                click: () => selectRef.current(modelId),
                mouseover: () => {
                  hoveredRef.current = modelId;
                  refresh();
                },
                mouseout: () => {
                  hoveredRef.current = null;
                  refresh();
                },
                add: () => {
                  const element = layer.getElement();
                  if (!element) return;
                  element.setAttribute("role", "button");
                  element.setAttribute("tabindex", "0");
                  element.setAttribute("aria-label", `Выбрать район ${displayName}`);
                  element.addEventListener("click", () => selectRef.current(modelId));
                  element.addEventListener("focus", () => {
                    hoveredRef.current = modelId;
                    refresh();
                  });
                  element.addEventListener("blur", () => {
                    hoveredRef.current = null;
                    refresh();
                  });
                  element.addEventListener("keydown", (event) => {
                    const keyboardEvent = event as KeyboardEvent;
                    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                    event.preventDefault();
                    selectRef.current(modelId);
                  });
                },
              });
            }
          },
        }).addTo(map);
        overlayRef.current = overlay;
        applyLayerStyles(
          districtLayers,
          selectedRef.current,
          hoveredRef.current,
          decisionsRef.current,
          initiativesRef.current,
        );
        map.fitBounds(overlay.getBounds(), { padding: [18, 18], animate: false });
        window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setFailed(true);
        setStatus(reason instanceof Error ? reason.message : "Карта временно недоступна.");
      }
    }

    void mount();
    return () => {
      disposed = true;
      controller.abort();
      districtLayers.clear();
      overlayRef.current?.remove();
      overlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [districts]);

  useEffect(() => {
    applyLayerStyles(
      layersRef.current,
      selectedDistrictId,
      hoveredRef.current,
      decisions,
      initiatives,
    );
  }, [decisions, initiatives, selectedDistrictId]);

  const selectedName = districts.find((district) => district.id === selectedDistrictId)?.name_ru;
  const citywideCount = decisions.filter(
    (decision) => initiatives.get(decision.initiative_id)?.scope === "city",
  ).length;

  return (
    <div className="osm-map-shell">
      <div className="map-caption">
        <span><i aria-hidden="true" /> Интерактивная карта</span>
        <small>Наведите или выберите район</small>
      </div>
      {citywideCount > 0 && (
        <div className="citywide-banner">Городских программ выбрано: {citywideCount}</div>
      )}
      <div
        ref={containerRef}
        className={`osm-map-canvas ${failed ? "failed" : ""}`}
        role="region"
        aria-label="Интерактивная карта районов Астаны"
      />
      <div className="osm-map-status" role="status">
        <span>{status}</span>
        <strong aria-live="polite">Выбран: {selectedName}</strong>
      </div>
      <div className="map-legend">
        <span><i className="legend-swatch selected" /> цель: {selectedName}</span>
        <span><i className="legend-swatch affected" /> получает эффект</span>
        <span><i className="legend-swatch context" /> район вне модели</span>
      </div>
      <div className="map-sources">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        <a href="https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0" target="_blank" rel="noreferrer">Геометрия: Astana architecture GIS</a>
      </div>
    </div>
  );
}
