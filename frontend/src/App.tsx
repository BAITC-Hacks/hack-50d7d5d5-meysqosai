import { useEffect, useMemo, useRef, useState } from "react";

import AstanaMap from "./AstanaMap";

type Direction = { id: string; name_ru: string; name_en: string };
type Indicator = {
  id: string;
  direction: string;
  weight: number;
  name_ru: string;
  name_en: string;
};
type District = {
  id: string;
  name_ru: string;
  name_en: string;
  population_share: number;
  profile_ru: string;
  indicators: Record<string, number>;
};
type Initiative = {
  id: string;
  direction: string;
  name_ru: string;
  scope: "city" | "district";
  cost: number;
  lag_quarters: number;
  effects: Record<string, number>;
};
type Catalog = {
  data_mode: "SAMPLE";
  dataset_version: string;
  budget: number;
  required_decisions: number;
  horizon_quarters: number;
  max_per_direction: number;
  baseline_score: number;
  directions: Direction[];
  indicators: Indicator[];
  districts: District[];
  initiatives: Initiative[];
};
type Decision = { initiative_id: string; district_id: string | null };
type Scenario = { id: number; name: string; decisions: Decision[] };
type Violation = { code: string; message: string; decision_indexes: number[] };
type Validation = {
  valid: boolean;
  total_cost: number;
  remaining_budget: number;
  decision_count: number;
  violations: Violation[];
};
type DistrictResult = {
  district_id: string;
  name_ru: string;
  before_score: number;
  after_score: number;
  score_delta: number;
};
type SimulationResult = Validation & {
  baseline_score: number;
  final_score: number;
  score_delta: number;
  critical_count: number;
  district_results: DistrictResult[];
  activated_synergies: string[];
  explanation: {
    summary: string;
    strengths: string[];
    risks: string[];
    recommendations: string[];
  };
};

const STORAGE_KEY = "meysqosai-scenarios-v1";

function defaultScenarios(): Scenario[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    name: `Сценарий ${index + 1}`,
    decisions: [],
  }));
}

function restoreScenarios(): Scenario[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultScenarios();
    const parsed = JSON.parse(saved) as Scenario[];
    return parsed.length === 5 ? parsed : defaultScenarios();
  } catch {
    return defaultScenarios();
  }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    const message = typeof payload.detail === "string" ? payload.detail : "Запрос не выполнен";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function scoreByDirection(catalog: Catalog, directionId: string): number {
  const indicators = catalog.indicators.filter((item) => item.direction === directionId);
  const weight = indicators.reduce((total, item) => total + item.weight, 0);
  return catalog.districts.reduce((cityTotal, district) => {
    const districtValue = indicators.reduce(
      (total, indicator) => total + district.indicators[indicator.id] * indicator.weight,
      0,
    );
    return cityTotal + (districtValue / weight) * district.population_share;
  }, 0);
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function BudgetPanel({
  catalog,
  scenario,
  initiatives,
  validation,
  result,
  onRemove,
}: {
  catalog: Catalog;
  scenario: Scenario;
  initiatives: Map<string, Initiative>;
  validation: Validation | null;
  result: SimulationResult | null;
  onRemove: (initiativeId: string) => void;
}) {
  const spent = scenario.decisions.reduce(
    (total, decision) => total + (initiatives.get(decision.initiative_id)?.cost ?? 0),
    0,
  );
  const reserve = catalog.budget - spent;
  const progress = Math.min(100, (spent / catalog.budget) * 100);

  return (
    <aside className="budget-panel" aria-label="Бюджет сценария">
      <div className="budget-heading">
        <div>
          <p className="section-kicker">Бюджет сценария</p>
          <h2>{catalog.budget} coin</h2>
        </div>
        <div
          className="coin-ring"
          style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}
          aria-label={`Потрачено ${spent} из ${catalog.budget}`}
        >
          <strong>{reserve}</strong>
          <span>резерв</span>
        </div>
      </div>

      <div className="budget-numbers">
        <span><small>Потрачено</small><strong>{spent}</strong></span>
        <span><small>Осталось</small><strong>{reserve}</strong></span>
      </div>
      <div className="budget-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="coin-grid" aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <i key={index} className={index < Math.ceil(spent / 5) ? "spent" : ""}>₵</i>
        ))}
      </div>

      <div className="decision-progress">
        <span>Решений принято</span>
        <strong>{scenario.decisions.length}/{catalog.required_decisions}</strong>
      </div>

      <div className="selected-list">
        {scenario.decisions.length === 0 ? (
          <p className="empty-copy">Выберите район и добавьте первую инициативу.</p>
        ) : (
          scenario.decisions.map((decision, index) => {
            const initiative = initiatives.get(decision.initiative_id);
            const district = catalog.districts.find((item) => item.id === decision.district_id);
            if (!initiative) return null;
            return (
              <div className="selected-item" key={decision.initiative_id}>
                <span className="decision-number">{index + 1}</span>
                <div>
                  <strong>{initiative.name_ru}</strong>
                  <small>{district?.name_ru ?? "Весь город"} · {initiative.cost} coin</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => onRemove(decision.initiative_id)}
                  aria-label={`Удалить ${initiative.name_ru}`}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className={`score-preview ${result ? "ready" : ""}`}>
        <span>Quality of Life Score</span>
        <strong>{result ? result.final_score.toFixed(2) : catalog.baseline_score.toFixed(2)}</strong>
        <small>
          {result ? `${result.score_delta >= 0 ? "+" : ""}${result.score_delta.toFixed(2)} к baseline` : "предварительно после 5 решений"}
        </small>
      </div>

      {validation && validation.violations.filter((item) => item.code !== "WRONG_DECISION_COUNT").map((item) => (
        <p className="validation-message" key={`${item.code}-${item.message}`}>{item.message}</p>
      ))}
    </aside>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(restoreScenarios);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedDistrictId, setSelectedDistrictId] = useState("nura");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const plannerRef = useRef<HTMLElement>(null);
  const activeScenario = scenarios[activeIndex];

  useEffect(() => {
    api<Catalog>("/api/simulator")
      .then((nextCatalog) => {
        setCatalog(nextCatalog);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setResult(null);
    api<Validation>("/api/scenarios/validate", {
      method: "POST",
      body: JSON.stringify({ decisions: activeScenario.decisions }),
      signal: controller.signal,
    })
      .then(async (nextValidation) => {
        setValidation(nextValidation);
        if (!nextValidation.valid) return;
        const simulation = await api<SimulationResult>("/api/scenarios/simulate", {
          method: "POST",
          body: JSON.stringify({ decisions: activeScenario.decisions }),
          signal: controller.signal,
        });
        setResult(simulation);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [catalog, activeScenario.decisions]);

  const initiatives = useMemo(
    () => new Map(catalog?.initiatives.map((item) => [item.id, item]) ?? []),
    [catalog],
  );

  if (!catalog) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">M</div>
        <h1>Загружаем модель города…</h1>
        {error && <p className="error-card">API недоступен: {error}</p>}
      </main>
    );
  }

  const model = catalog;

  const selectedDistrict =
    catalog.districts.find((district) => district.id === selectedDistrictId) ?? catalog.districts[0];
  const rankedDistrictIndicators = catalog.indicators
    .map((indicator) => ({
      ...indicator,
      value: selectedDistrict.indicators[indicator.id],
    }))
    .sort((left, right) => left.value - right.value);
  const districtAverage =
    rankedDistrictIndicators.reduce((total, indicator) => total + indicator.value, 0) /
    rankedDistrictIndicators.length;
  const districtDecisionCount = activeScenario.decisions.filter(
    (decision) => decision.district_id === selectedDistrict.id,
  ).length;
  const selectedIds = new Set(activeScenario.decisions.map((decision) => decision.initiative_id));
  const spent = activeScenario.decisions.reduce(
    (total, decision) => total + (initiatives.get(decision.initiative_id)?.cost ?? 0),
    0,
  );

  function updateActive(updater: (scenario: Scenario) => Scenario) {
    setScenarios((current) => current.map((scenario, index) => index === activeIndex ? updater(scenario) : scenario));
  }

  function addInitiative(initiative: Initiative) {
    setNotice("");
    if (selectedIds.has(initiative.id)) {
      setNotice("Эта инициатива уже добавлена в сценарий.");
      return;
    }
    if (activeScenario.decisions.length >= model.required_decisions) {
      setNotice("В сценарии уже принято пять решений. Удалите одно, чтобы заменить его.");
      return;
    }
    if (spent + initiative.cost > model.budget) {
      setNotice(
        `Это решение превышает бюджет сценария на ${spent + initiative.cost - model.budget} coin. Выберите более доступное мероприятие или измените другое решение.`,
      );
      return;
    }
    const directionCount = activeScenario.decisions.filter(
      (decision) => initiatives.get(decision.initiative_id)?.direction === initiative.direction,
    ).length;
    if (directionCount >= model.max_per_direction) {
      setNotice(`В одном направлении можно выбрать не более ${model.max_per_direction} решений.`);
      return;
    }
    const decision: Decision = {
      initiative_id: initiative.id,
      district_id: initiative.scope === "city" ? null : selectedDistrictId,
    };
    updateActive((scenario) => ({ ...scenario, decisions: [...scenario.decisions, decision] }));
  }

  function removeInitiative(initiativeId: string) {
    setNotice("");
    updateActive((scenario) => ({
      ...scenario,
      decisions: scenario.decisions.filter((decision) => decision.initiative_id !== initiativeId),
    }));
  }

  function resetScenario() {
    if (!window.confirm(`Сбросить «${activeScenario.name}»?`)) return;
    updateActive((scenario) => ({ ...scenario, decisions: [] }));
    setNotice("");
  }

  function resetAll() {
    if (!window.confirm("Удалить все пять сценариев и начать заново?")) return;
    setScenarios(defaultScenarios());
    setActiveIndex(0);
    setNotice("");
  }

  function copyPrevious() {
    if (activeIndex === 0) return;
    const previous = scenarios[activeIndex - 1];
    updateActive((scenario) => ({
      ...scenario,
      decisions: previous.decisions.map((decision) => ({ ...decision })),
    }));
    setNotice("Сценарий скопирован. Измените хотя бы одно решение, чтобы сделать вариант уникальным.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MeysQosAI — наверх">
          <span className="brand-mark">M</span>
          <span><strong>MeysQosAI</strong><small>Городской AI-симулятор</small></span>
        </a>
        <div className="topbar-actions">
          <span className="demo-badge">Синтетические данные • Demo model</span>
          <button className="text-button" onClick={resetAll}>Начать заново</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="astana-badge">Астана • Казахстан</span>
            <p className="eyebrow">Управленческая симуляция • 5 часов</p>
            <h1>Вы — аким.<br />Город ждёт решений.</h1>
            <p>
              Изучите потребности районов, распределите 100 coin между пятью инициативами
              и увидьте, как выбор меняет качество жизни в городе.
            </p>
            <div className="hero-actions">
              <button onClick={() => plannerRef.current?.scrollIntoView({ behavior: "smooth" })}>
                Начать планирование
              </button>
              <span>Baseline Score <strong>{catalog.baseline_score.toFixed(2)}</strong></span>
            </div>
          </div>
          <div className="hero-metrics" aria-label="Исходные показатели города">
            {catalog.directions.map((direction, index) => {
              const value = scoreByDirection(catalog, direction.id);
              return (
                <div className="metric-orbit" key={direction.id} style={{ "--index": index } as React.CSSProperties}>
                  <strong>{value.toFixed(0)}</strong>
                  <span>{direction.name_ru}</span>
                </div>
              );
            })}
            <div className="hero-core"><strong>100</strong><span>coin</span></div>
          </div>
        </section>

        <section className="planner" ref={plannerRef} id="planner">
          <div className="planner-header">
            <div>
              <p className="section-kicker">Конструктор сценариев</p>
              <h2>Соберите пять вариантов бюджета</h2>
              <p>Каждый сценарий начинается с одинакового baseline и собственного бюджета 100 coin.</p>
            </div>
            <div className="scenario-tools">
              {activeIndex > 0 && <button className="secondary-button" onClick={copyPrevious}>Копировать предыдущий</button>}
              <button className="danger-button" onClick={resetScenario}>Сбросить сценарий</button>
            </div>
          </div>

          <div className="scenario-tabs" role="tablist" aria-label="Сценарии">
            {scenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                role="tab"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "active" : ""}
                onClick={() => {
                  setActiveIndex(index);
                  setNotice("");
                }}
              >
                <span>{index + 1}</span>
                <strong>{scenario.name}</strong>
                <small>{scenario.decisions.length}/5 решений</small>
              </button>
            ))}
          </div>

          <div className="scenario-name-row">
            <label htmlFor="scenario-name">Название активного сценария</label>
            <input
              id="scenario-name"
              value={activeScenario.name}
              maxLength={42}
              onChange={(event) => updateActive((scenario) => ({ ...scenario, name: event.target.value }))}
            />
            <span>Автосохранение включено</span>
          </div>

          {notice && <div className="notice" role="status">{notice}</div>}
          {error && <div className="error-card" role="alert">{error}</div>}

          <div className="workspace-grid">
            <aside className="context-panel">
              <p className="section-kicker">Город сегодня</p>
              <h3>Текущие параметры</h3>
              <p className="muted">Показатели 0–100. Чем выше, тем лучше.</p>
              <div className="baseline-list">
                {catalog.directions.map((direction) => {
                  const value = scoreByDirection(catalog, direction.id);
                  return (
                    <div key={direction.id}>
                      <span>{direction.name_ru}<strong>{value.toFixed(0)}</strong></span>
                      <i><b style={{ width: `${value}%` }} /></i>
                    </div>
                  );
                })}
              </div>
              <div className="baseline-score">
                <small>Исходный Quality of Life Score</small>
                <strong>{catalog.baseline_score.toFixed(2)}</strong>
              </div>
              <div className="model-note">
                <strong>О модели</strong>
                <p>Все значения синтетические. Числа считает детерминированный движок, не AI.</p>
              </div>
            </aside>

            <div className="planning-canvas">
              <section className="map-section">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Контекст решения</p>
                    <h3>Районы Астаны</h3>
                    <p className="section-subtitle">Выберите территорию, чтобы увидеть её профиль и направить районную инициативу.</p>
                  </div>
                  <span className="map-mode-pill"><i aria-hidden="true" /> Выбор района</span>
                </div>
                <AstanaMap
                  districts={catalog.districts}
                  selectedDistrictId={selectedDistrictId}
                  onSelectDistrict={setSelectedDistrictId}
                  decisions={activeScenario.decisions}
                  initiatives={initiatives}
                />
                <article className="district-summary" aria-live="polite">
                  <div className="district-summary-copy">
                    <span className="selection-marker" aria-hidden="true">✓</span>
                    <div>
                      <p className="section-kicker">Выбранный район</p>
                      <h4>{selectedDistrict.name_ru}</h4>
                      <p>{selectedDistrict.profile_ru}</p>
                    </div>
                  </div>
                  <div className="district-highlights" aria-label={`Краткий профиль района ${selectedDistrict.name_ru}`}>
                    <span>
                      <small>Доля населения</small>
                      <strong>{Math.round(selectedDistrict.population_share * 100)}%</strong>
                    </span>
                    <span>
                      <small>Среднее по метрикам</small>
                      <strong>{districtAverage.toFixed(0)}</strong>
                    </span>
                    <span className="attention">
                      <small>Точка внимания</small>
                      <strong>{rankedDistrictIndicators[0].value}</strong>
                      <em>{rankedDistrictIndicators[0].name_ru}</em>
                    </span>
                    <span className="decisions">
                      <small>Решений здесь</small>
                      <strong>{districtDecisionCount}</strong>
                    </span>
                  </div>
                  <details className="indicator-details">
                    <summary>Все 10 показателей</summary>
                    <div className="indicator-grid">
                      {catalog.indicators.map((indicator) => (
                        <span key={indicator.id}>
                          <small>{indicator.id}</small>
                          <strong>{selectedDistrict.indicators[indicator.id]}</strong>
                          <em>{indicator.name_ru}</em>
                        </span>
                      ))}
                    </div>
                  </details>
                </article>
              </section>

              <section className="initiatives-section">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Каталог мер</p>
                    <h3>Выберите ровно пять решений</h3>
                  </div>
                  <span className="rule-pill">Макс. 2 из одного направления</span>
                </div>
                {catalog.directions.map((direction) => {
                  const directionInitiatives = catalog.initiatives.filter(
                    (initiative) => initiative.direction === direction.id,
                  );
                  const selectedCount = activeScenario.decisions.filter(
                    (decision) => initiatives.get(decision.initiative_id)?.direction === direction.id,
                  ).length;
                  return (
                    <div className="direction-group" key={direction.id}>
                      <div className="direction-title">
                        <h4>{direction.name_ru}</h4>
                        <span>{selectedCount}/{catalog.max_per_direction} выбрано</span>
                      </div>
                      <div className="initiative-grid">
                        {directionInitiatives.map((initiative) => {
                          const selected = selectedIds.has(initiative.id);
                          const negativeEffects = Object.entries(initiative.effects).filter(([, value]) => value < 0);
                          return (
                            <article className={`initiative-card ${selected ? "selected" : ""}`} key={initiative.id}>
                              <div className="initiative-meta">
                                <span>{initiative.id}</span>
                                <span className={initiative.scope === "city" ? "scope city" : "scope district"}>
                                  {initiative.scope === "city" ? "Весь город" : selectedDistrict.name_ru}
                                </span>
                              </div>
                              <h5>{initiative.name_ru}</h5>
                              <div className="effects">
                                {Object.entries(initiative.effects).map(([indicator, value]) => (
                                  <span className={value < 0 ? "negative" : ""} key={indicator}>
                                    {indicator} {signed(value)}
                                  </span>
                                ))}
                              </div>
                              <p>
                                Эффект с {initiative.lag_quarters}-го квартала
                                {negativeEffects.length > 0 ? " · есть компромисс" : " · без отрицательного эффекта в модели"}
                              </p>
                              <div className="initiative-footer">
                                <strong>{initiative.cost} <small>coin</small></strong>
                                <button
                                  className={selected ? "selected-button" : "add-button"}
                                  onClick={() => selected ? removeInitiative(initiative.id) : addInitiative(initiative)}
                                >
                                  {selected ? "Убрать" : "Добавить"}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>

              {result && (
                <section className="result-panel">
                  <div className="result-score">
                    <p className="section-kicker">Сценарий рассчитан</p>
                    <strong>{result.final_score.toFixed(2)}</strong>
                    <span>{result.score_delta >= 0 ? "+" : ""}{result.score_delta.toFixed(2)} к baseline</span>
                  </div>
                  <div className="result-copy">
                    <h3>
                      Score изменился на {result.score_delta >= 0 ? "+" : ""}
                      {result.score_delta.toFixed(2)} пункта
                    </h3>
                    <p>
                      Наибольший прирост получил район {result.district_results.reduce(
                        (best, district) => district.score_delta > best.score_delta ? district : best,
                      ).name_ru}.
                    </p>
                    <div className="district-deltas">
                      {result.district_results.map((district) => (
                        <span key={district.district_id}>
                          {district.name_ru}
                          <strong>{district.score_delta >= 0 ? "+" : ""}{district.score_delta.toFixed(2)}</strong>
                        </span>
                      ))}
                    </div>
                    {result.activated_synergies.length > 0 && (
                      <p className="synergy-note">Сработала синергия: {result.activated_synergies.join(", ")}</p>
                    )}
                  </div>
                </section>
              )}
            </div>

            <BudgetPanel
              catalog={catalog}
              scenario={activeScenario}
              initiatives={initiatives}
              validation={validation}
              result={result}
              onRemove={removeInitiative}
            />
          </div>
        </section>
      </main>

      <footer>
        <strong>MeysQosAI</strong>
        <span>Синтетическая модель для демонстрации • не официальная статистика Астаны</span>
      </footer>
    </div>
  );
}
