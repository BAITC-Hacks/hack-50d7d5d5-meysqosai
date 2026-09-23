import { useEffect, useMemo, useRef, useState } from "react";

import AstanaMap from "./AstanaMap";
import Icon, { type IconName } from "./Icon";

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
type ContextIndicator = {
  indicator_id: string;
  name_ru: string;
  value: number;
};
type CityNeed = ContextIndicator & {
  district_id: string;
  district_name_ru: string;
  severity: "critical" | "attention";
};
type DistrictContext = {
  district_id: string;
  name_ru: string;
  profile_ru: string;
  score: number;
  priority_indicators: ContextIndicator[];
  strong_indicators: ContextIndicator[];
};
type Catalog = {
  data_mode: "SAMPLE";
  dataset_version: string;
  budget: number;
  required_decisions: number;
  horizon_quarters: number;
  max_per_direction: number;
  baseline_score: number;
  city_context: {
    mission_ru: string;
    data_disclosure_ru: string;
    goals: string[];
    baseline_snapshot: {
      critical_count: number;
      weakest_district: { name_ru: string; score: number };
      direction_scores: { direction_id: string; name_ru: string; value: number }[];
      districts: DistrictContext[];
      city_needs: CityNeed[];
    };
  };
  directions: Direction[];
  indicators: Indicator[];
  districts: District[];
  initiatives: Initiative[];
};
type Decision = {
  initiative_id: string;
  scope: "city" | "district";
  district_id: string | null;
};
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
    verdict: "improved" | "mixed" | "declined";
    strengths: string[];
    risks: string[];
    tradeoffs: string[];
    resource_assessment: string;
    recommendations: string[];
  };
  ai_provider: string;
  report_context: {
    selected_decisions: {
      initiative_id: string;
      name_ru: string;
      direction_name_ru: string;
      target_name_ru: string;
      cost: number;
      lag_quarters: number;
      realized_fraction: number;
      realized_effects: {
        indicator_id: string;
        indicator_name_ru: string;
        delta: number;
      }[];
      rationale_ru: string;
    }[];
  };
};
type EvidenceStatus = {
  status: "empty" | "ready" | "cached" | "error" | "unavailable";
  provider: string | null;
  item_count: number;
  error_code: string | null;
  updated_at: string | null;
};
type Comparison = { winner_indexes: number[]; best_score: number; provider: string; conclusion: string; reasons: string[]; limitations: string[] };
type EvidenceItem = {
  id: number;
  title: string;
  url: string;
  publisher: string;
  published_at: string;
  direction: string;
  claim_type: "plan" | "reported_output" | "reported_outcome" | "independent_statistic" | "audit_issue";
  claim: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};
type EvidenceAdvice = {
  data_mode: "MIXED";
  disclosure: string;
  evidence_status: EvidenceStatus;
  advice_provider: string;
  city_digest: {
    proven_patterns: string[];
    caution_signals: string[];
    evidence_gaps: string[];
  };
  recommendations: {
    initiative_id: string;
    assessment: "supported" | "promising_with_conditions" | "caution" | "not_recommended" | "insufficient_evidence";
    confidence: "high" | "medium" | "low";
    rationale: string;
    conditions: string[];
    evidence: EvidenceItem[];
  }[];
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
    if (parsed.length !== 5) return defaultScenarios();
    return parsed.map((scenario) => ({
      ...scenario,
      decisions: scenario.decisions.map((decision) => ({
        ...decision,
        scope: decision.scope ?? (decision.district_id === null ? "city" : "district"),
      })),
    }));
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

const directionIcons: Record<string, IconName> = {
  transport: "transport",
  environment: "environment",
  social: "social",
  safety: "safety",
  services: "services",
};

function quarterLabel(value: number): string {
  return value === 1 ? "1-го квартала" : `${value}-го квартала`;
}

const assessmentLabels: Record<EvidenceAdvice["recommendations"][number]["assessment"], string> = {
  supported: "Подтверждено",
  promising_with_conditions: "Перспективно с условиями",
  caution: "Нужна осторожность",
  not_recommended: "Не рекомендуется",
  insufficient_evidence: "Недостаточно данных",
};

const claimTypeLabels: Record<EvidenceItem["claim_type"], string> = {
  plan: "План",
  reported_output: "Выполненная работа",
  reported_outcome: "Заявленный результат",
  independent_statistic: "Независимая статистика",
  audit_issue: "Аудиторский риск",
};

const confidenceLabels = { high: "высокая", medium: "средняя", low: "низкая" };
const evidenceStatusLabels = { empty: "нет источников", ready: "источники обновлены", cached: "сохранённые источники", error: "ошибка обновления", unavailable: "источники недоступны" };
function reportProviderLabel(provider: string): string {
  return provider === "openai" ? "ИИ-анализ" : provider === "mock-fallback" ? "резервный отчёт по расчётам" : "отчёт по расчётам";
}

function violationLabel(item: Violation): string {
  const labels: Record<string, string> = {
    WRONG_DECISION_COUNT: "Выберите ровно пять мероприятий.",
    DUPLICATE_INITIATIVE: "Одно мероприятие нельзя выбирать дважды.",
    UNKNOWN_INITIATIVE: "Неизвестное мероприятие. Выберите его из каталога.",
    INVALID_SCOPE: "Укажите область применения: город или район.",
    SCOPE_NOT_ALLOWED: "Область применения не соответствует выбранному мероприятию.",
    DISTRICT_REQUIRED: "Для районного мероприятия обязательно выберите район.",
    DISTRICT_NOT_ALLOWED: "Для общегородского мероприятия район не указывается.",
    UNKNOWN_DISTRICT: "Выберите район из списка доступных.",
    BUDGET_EXCEEDED: "Стоимость выбранных мероприятий превышает бюджет 100 единиц.",
    DIRECTION_LIMIT_EXCEEDED: "В одном направлении можно выбрать не более двух мероприятий.",
    INCOMPATIBLE_INITIATIVES: `Несовместимые мероприятия: решения ${item.decision_indexes.map((index) => index + 1).join(" и ")}. Замените одно из них или проверьте выбранные районы.`,
  };
  return labels[item.code] ?? "Набор не прошёл проверку. Проверьте выбранные мероприятия.";
}

function BudgetPanel({
  catalog,
  scenario,
  initiatives,
  validation,
  result,
  onRemove,
  onComplete,
  completeDisabled,
}: {
  catalog: Catalog;
  scenario: Scenario;
  initiatives: Map<string, Initiative>;
  validation: Validation | null;
  result: SimulationResult | null;
  onRemove: (initiativeId: string) => void;
  onComplete: () => void;
  completeDisabled: boolean;
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
          <p className="section-kicker icon-label"><Icon name="budget" size={15} /> Бюджет сценария</p>
          <h2>{catalog.budget} бюджетных единиц</h2>
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
          <i key={index} className={index < Math.ceil(spent / 5) ? "spent" : ""} />
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
                  <small>{district?.name_ru ?? "Весь город"} · {initiative.cost} ед.</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => onRemove(decision.initiative_id)}
                  aria-label={`Удалить ${initiative.name_ru}`}
                >
                  <Icon name="remove" size={15} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className={`score-preview ${result ? "ready" : ""}`}>
        <span>Индекс качества жизни</span>
        <strong>{result ? result.final_score.toFixed(2) : catalog.baseline_score.toFixed(2)}</strong>
        <small>
          {result ? `${result.score_delta >= 0 ? "+" : ""}${result.score_delta.toFixed(2)} к исходному значению` : "исходное значение · результаты после отправки всех сценариев"}
        </small>
      </div>

      {validation && validation.violations.filter((item) => item.code !== "WRONG_DECISION_COUNT").map((item) => (
        <p className="validation-message" key={`${item.code}-${item.message}`}>{violationLabel(item)}</p>
      ))}
      <button className="primary-button budget-complete" disabled={completeDisabled} onClick={onComplete}><Icon name="check" size={16} /> Завершить сценарий</button>
    </aside>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(restoreScenarios);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedDistrictId, setSelectedDistrictId] = useState("nura");
  const [targetScope, setTargetScope] = useState<"city" | "district">("district");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [results, setResults] = useState<(SimulationResult | null)[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reportIndex, setReportIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState("");
  const [submitError, setSubmitError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitLock = useRef(false);
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus | null>(null);
  const [evidenceAdvice, setEvidenceAdvice] = useState<EvidenceAdvice | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
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
    api<EvidenceStatus>("/api/evidence/status")
      .then(setEvidenceStatus)
      .catch((reason: Error) => setEvidenceError(reason.message));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setValidation(null);
    setError("");
    api<Validation>("/api/scenarios/validate", {
      method: "POST",
      body: JSON.stringify({ decisions: activeScenario.decisions }),
      signal: controller.signal,
    })
      .then(setValidation)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [catalog, activeScenario.decisions]);

  useEffect(() => {
    if (!result || !evidenceStatus?.item_count) {
      setEvidenceAdvice(null);
      return;
    }
    const controller = new AbortController();
    setEvidenceBusy(true);
    setEvidenceError("");
    api<EvidenceAdvice>("/api/scenarios/advise", {
      method: "POST",
      body: JSON.stringify({ decisions: scenarios[reportIndex].decisions }),
      signal: controller.signal,
    })
      .then((nextAdvice) => {
        setEvidenceAdvice(nextAdvice);
        setEvidenceStatus(nextAdvice.evidence_status);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setEvidenceError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setEvidenceBusy(false);
      });
    return () => controller.abort();
  }, [result, evidenceStatus?.item_count, evidenceStatus?.updated_at, reportIndex, scenarios]);

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
  const cityDecisionCount = activeScenario.decisions.filter(
    (decision) => decision.scope === "city",
  ).length;
  const selectedIds = new Set(activeScenario.decisions.map((decision) => decision.initiative_id));
  const spent = activeScenario.decisions.reduce(
    (total, decision) => total + (initiatives.get(decision.initiative_id)?.cost ?? 0),
    0,
  );

  function updateActive(updater: (scenario: Scenario) => Scenario) {
    if (submitLock.current || confirming) return;
    const next = updater(activeScenario);
    if (next.decisions !== activeScenario.decisions) {
      setCompleted((current) => current.slice(0, activeIndex));
      setResults([]);
      setResult(null);
      setValidation(null);
    }
    setScenarios((current) => current.map((scenario, index) => index === activeIndex ? next : scenario));
  }

  const isCompleted = (index: number) => completed[index] === JSON.stringify(scenarios[index].decisions);
  const allCompleted = scenarios.every((_, index) => isCompleted(index));

  async function completeScenario() {
    setConfirming(true);
    setError("");
    try {
      const checked = await api<Validation>("/api/scenarios/validate", {
        method: "POST", body: JSON.stringify({ decisions: activeScenario.decisions }),
      });
      setValidation(checked);
      if (!checked.valid) return;
      setCompleted((current) => {
        const next = [...current];
        next[activeIndex] = JSON.stringify(activeScenario.decisions);
        return next;
      });
      if (activeIndex < scenarios.length - 1) {
        setValidation(null);
        setActiveIndex(activeIndex + 1);
        plannerRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Проверка не выполнена");
    } finally { setConfirming(false); }
  }

  async function submitScenarios() {
    if (!allCompleted || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    setComparison(null);
    setResult(null);
    setResults([]);
    dialogRef.current?.showModal();
    try {
      setProgress("Проверяем все пять сценариев…");
      const checks = await Promise.all(scenarios.map((scenario) => api<Validation>("/api/scenarios/validate", {
        method: "POST", body: JSON.stringify({ decisions: scenario.decisions }),
      })));
      const invalid = checks.findIndex((check) => !check.valid);
      if (invalid >= 0) {
        setCompleted((current) => current.slice(0, invalid));
        setActiveIndex(invalid);
        throw new Error(`${scenarios[invalid].name}: ${checks[invalid].violations.map(violationLabel).join(" ")}`);
      }
      const nextResults: SimulationResult[] = [];
      for (const [index, scenario] of scenarios.entries()) {
        setProgress(`Расчёт и отчёт ИИ: сценарий ${index + 1} из 5…`);
        nextResults.push(await api<SimulationResult>("/api/scenarios/simulate", {
          method: "POST", body: JSON.stringify({ decisions: scenario.decisions }),
        }));
      }
      setProgress("ИИ сравнивает все сценарии и формулирует общий вывод…");
      let overview: Comparison;
      try {
        overview = await api<Comparison>("/api/scenarios/compare", {
          method: "POST", body: JSON.stringify({ scenarios: scenarios.map((scenario) => ({ decisions: scenario.decisions })) }),
        });
      } catch {
        const best = Math.max(...nextResults.map((item) => item.final_score));
        overview = { winner_indexes: nextResults.flatMap((item, index) => item.final_score === best ? [index] : []), best_score: best,
          provider: "mock-fallback", conclusion: "Общий вывод ИИ временно недоступен. Лидеры определены по рассчитанному индексу; при равенстве единственного победителя нет.", reasons: [], limitations: ["Изучите риски и компромиссы в разборе каждого сценария."] };
      }
      setComparison(overview);
      setResults(nextResults);
      setReportIndex(overview.winner_indexes[0]);
      setResult(nextResults[overview.winner_indexes[0]]);
      setProgress("");
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "Не удалось рассчитать сценарии. Повторите отправку.");
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  function addInitiative(initiative: Initiative) {
    setNotice("");
    if (initiative.scope !== targetScope) {
      setNotice(
        targetScope === "city"
          ? "Эта мера применяется к отдельному району. Выберите район на карте."
          : "Это общегородская мера. Выберите карточку «Весь город» справа от карты.",
      );
      return;
    }
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
        `Это решение превышает бюджет сценария на ${spent + initiative.cost - model.budget} единиц. Выберите более доступное мероприятие или измените другое решение.`,
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
      scope: targetScope,
      district_id: targetScope === "city" ? null : selectedDistrictId,
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
    if (submitLock.current || confirming) return;
    if (!window.confirm("Удалить все пять сценариев и начать заново?")) return;
    setScenarios(defaultScenarios());
    setActiveIndex(0);
    setCompleted([]);
    setResults([]);
    setResult(null);
    setNotice("");
  }

  function copyPrevious() {
    if (activeIndex === 0) return;
    const previous = scenarios[activeIndex - 1];
    updateActive((scenario) => ({
      ...scenario,
      decisions: previous.decisions.map((decision) => ({ ...decision })),
    }));
    setNotice("Сценарий скопирован. Проверьте выбор и подтвердите завершение.");
  }

  async function refreshEvidence() {
    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      const nextStatus = await api<EvidenceStatus>("/api/evidence/refresh", { method: "POST" });
      setEvidenceStatus(nextStatus);
      setEvidenceAdvice(null);
    } catch (reason) {
      setEvidenceError(reason instanceof Error ? reason.message : "Источники не обновлены");
    } finally {
      setEvidenceBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MeysQosAI — наверх">
          <span className="brand-mark">M</span>
          <span><strong>MeysQosAI</strong><small>Городской ИИ-симулятор</small></span>
        </a>
        <div className="topbar-actions">
          <span className="demo-badge">Синтетические данные • демомодель</span>
          <button className="text-button icon-label" onClick={resetAll}><Icon name="reset" size={16} /> Начать заново</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="astana-badge">Астана • Казахстан</span>
            <p className="eyebrow">Управленческая симуляция • 5 часов</p>
            <h1>Вы — аким.<br />Город ждёт решений.</h1>
            <p>
              Изучите потребности районов, распределите 100 бюджетных единиц между пятью инициативами
              и увидьте, как выбор меняет качество жизни в городе.
            </p>
            <div className="hero-actions">
              <button onClick={() => plannerRef.current?.scrollIntoView({ behavior: "smooth" })}>
                Начать планирование
              </button>
              <span>Исходный индекс <strong>{catalog.baseline_score.toFixed(2)}</strong></span>
            </div>
          </div>
          <div className="hero-metrics" aria-label="Исходные показатели города">
            {catalog.directions.map((direction, index) => {
              const value = scoreByDirection(catalog, direction.id);
              return (
                <div className="metric-orbit" key={direction.id} style={{ "--index": index } as React.CSSProperties}>
                  <Icon name={directionIcons[direction.id] ?? "info"} size={20} />
                  <strong>{value.toFixed(0)}</strong>
                  <span>{direction.name_ru}</span>
                </div>
              );
            })}
            <div className="hero-core"><Icon name="budget" size={22} /><strong>100</strong><span>единиц</span></div>
          </div>
        </section>

        <section className="planner" ref={plannerRef} id="planner">
          <div className="planner-header">
            <div>
              <p className="section-kicker">Конструктор сценариев</p>
              <h2>Соберите пять вариантов бюджета</h2>
              <p>Каждый сценарий начинается с одинакового исходного индекса и бюджета 100 единиц.</p>
            </div>
            <div className="scenario-tools">
              {activeIndex > 0 && <button className="secondary-button icon-label" onClick={copyPrevious}><Icon name="copy" size={16} /> Копировать предыдущий</button>}
              <button className="danger-button icon-label" onClick={resetScenario}><Icon name="reset" size={16} /> Сбросить сценарий</button>
            </div>
          </div>

          <div className="scenario-tabs" role="tablist" aria-label="Сценарии">
            {scenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                role="tab"
                aria-selected={index === activeIndex}
                disabled={confirming || submitting || scenarios.slice(0, index).some((_, previous) => !isCompleted(previous))}
                className={index === activeIndex ? "active" : ""}
                onClick={() => {
                  setActiveIndex(index);
                  setNotice("");
                }}
              >
                <span>{index + 1}</span>
                <strong>{scenario.name}</strong>
                <small>{isCompleted(index) ? "Завершён ✓" : `${scenario.decisions.length}/5 решений`}</small>
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

          <section className="workflow-panel" aria-label="Завершение сценариев">
            <div>
              <strong>Шаг {activeIndex + 1} из 5 · завершено {completed.length}/5</strong>
              <p>В каждом сценарии: ровно 5 разных мер, не более 100 единиц и 2 мер одного направления. Достаточно минимум 3 направлений — все блоки заполнять не нужно. Остаток сохраняется, бонуса не даёт.</p>
              <p>Подтвердите текущий сценарий, чтобы открыть следующий. Изменение выбора требует повторного подтверждения этого и последующих сценариев; сами выбранные меры сохраняются.</p>
            </div>
            <button className="secondary-button icon-label" disabled={!validation?.valid || confirming || submitting || isCompleted(activeIndex)} onClick={completeScenario}>
              <Icon name="check" size={16} />
              {confirming ? "Проверяем…" : isCompleted(activeIndex) ? "Сценарий завершён ✓" : activeIndex < 4 ? "Завершить и перейти дальше" : "Завершить пятый сценарий"}
            </button>
            <button className="primary-button" disabled={!allCompleted || submitting} onClick={submitScenarios}><Icon name="effect" size={16} /> Рассчитать все 5 сценариев</button>
            {results.length === 5 && <button className="secondary-button" onClick={() => dialogRef.current?.showModal()}>Открыть результаты</button>}
          </section>

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
                      <span className="direction-score"><span><Icon name={directionIcons[direction.id] ?? "info"} size={16} />{direction.name_ru}</span><strong>{value.toFixed(0)}</strong></span>
                      <i><b style={{ width: `${value}%` }} /></i>
                    </div>
                  );
                })}
              </div>
              <div className="baseline-score">
                <small>Исходный индекс качества жизни</small>
                <strong>{catalog.baseline_score.toFixed(2)}</strong>
              </div>
              <div className="model-note">
                <strong>О модели</strong>
                <p>Все значения синтетические. Расчёты выполняет прозрачная математическая модель, а не ИИ.</p>
              </div>
              <div className="model-note city-theory">
                <strong>Цель управления</strong>
                <p>{catalog.city_context.mission_ru}</p>
                <small>
                  Слабейший район до изменений: {catalog.city_context.baseline_snapshot.weakest_district.name_ru}
                  {" · "}{catalog.city_context.baseline_snapshot.weakest_district.score.toFixed(2)}
                  {" · критических показателей: "}{catalog.city_context.baseline_snapshot.critical_count}
                </small>
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
                  <span className="map-mode-pill"><Icon name={targetScope === "city" ? "city" : "district"} size={16} /> {targetScope === "city" ? "Весь город" : "Выбор района"}</span>
                </div>
                <div className="map-target-layout">
                  <AstanaMap
                    districts={catalog.districts}
                    selectedDistrictId={selectedDistrictId}
                    selectionScope={targetScope}
                    onSelectDistrict={(districtId) => {
                      setSelectedDistrictId(districtId);
                      setTargetScope("district");
                    }}
                    decisions={activeScenario.decisions}
                    initiatives={initiatives}
                  />
                  <aside className="target-switcher" aria-label="Область применения решения">
                    <p className="section-kicker">Область решения</p>
                    <button
                      type="button"
                      className={targetScope === "city" ? "active city-target" : "city-target"}
                      aria-pressed={targetScope === "city"}
                      onClick={() => setTargetScope("city")}
                    >
                      <span className="target-icon"><Icon name="city" size={19} /></span>
                      <strong>Весь город</strong>
                      <small>Эффект сразу для всех пяти районов</small>
                      <em>{cityDecisionCount} решений выбрано</em>
                    </button>
                    <button
                      type="button"
                      className={targetScope === "district" ? "active district-target" : "district-target"}
                      aria-pressed={targetScope === "district"}
                      onClick={() => setTargetScope("district")}
                    >
                      <span className="target-icon"><Icon name="district" size={19} /></span>
                      <strong>{selectedDistrict.name_ru}</strong>
                      <small>Точечный эффект в выбранном районе</small>
                      <em>{districtDecisionCount} решений выбрано</em>
                    </button>
                    <p className="target-help">Клик по району на карте автоматически переключает цель на район.</p>
                  </aside>
                </div>
                <article className="district-summary" aria-live="polite">
                  <div className="district-summary-copy">
                    <span className="selection-marker"><Icon name="check" size={19} /></span>
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
                    <summary>Показать все 10 показателей и технические коды</summary>
                    <div className="indicator-grid">
                      {catalog.indicators.map((indicator) => (
                        <span key={indicator.id}>
                          <small title="Технический код показателя">{indicator.id}</small>
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
                  <span className="rule-pill"><Icon name="info" size={15} /> Не более 2 решений из одного направления</span>
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
                        <h4><span className="direction-icon"><Icon name={directionIcons[direction.id] ?? "info"} size={19} /></span>{direction.name_ru}</h4>
                        <span>{selectedCount}/{catalog.max_per_direction} выбрано</span>
                      </div>
                      <div className="initiative-grid">
                        {directionInitiatives.map((initiative) => {
                          const selected = selectedIds.has(initiative.id);
                          const availableForTarget = initiative.scope === targetScope;
                          const negativeEffects = Object.entries(initiative.effects).filter(([, value]) => value < 0);
                          const directionLimitReached = selectedCount >= catalog.max_per_direction;
                          const decisionLimitReached = activeScenario.decisions.length >= catalog.required_decisions;
                          const overBudget = spent + initiative.cost > catalog.budget;
                          const disabledReason = !availableForTarget
                            ? `Сначала выберите область «${initiative.scope === "city" ? "Весь город" : "Район"}»`
                            : directionLimitReached
                              ? "Достигнут лимит для этого направления"
                              : decisionLimitReached
                                ? "Уже выбрано пять решений"
                                : overBudget
                                  ? "Недостаточно бюджета"
                                  : "";
                          const disabled = !selected && Boolean(disabledReason);
                          return (
                            <article
                              role="button"
                              tabIndex={0}
                              className={`initiative-card ${selected ? "selected" : ""}`}
                              key={initiative.id}
                              aria-disabled={disabled}
                              aria-pressed={selected}
                              aria-label={`${selected ? "Убрать" : "Добавить"} инициативу «${initiative.name_ru}», стоимость ${initiative.cost} бюджетных единиц`}
                              title={selected ? "Убрать инициативу из сценария" : disabledReason || "Добавить инициативу в сценарий"}
                              onClick={() => {
                                if (disabled) return;
                                if (selected) removeInitiative(initiative.id);
                                else addInitiative(initiative);
                              }}
                              onKeyDown={(event) => {
                                if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
                                event.preventDefault();
                                if (selected) removeInitiative(initiative.id);
                                else addInitiative(initiative);
                              }}
                            >
                              <div className="initiative-meta">
                                <span className="audit-code" title="Технический код инициативы">Код {initiative.id}</span>
                                <span className={initiative.scope === "city" ? "scope city" : "scope district"}>
                                  <Icon name={initiative.scope === "city" ? "city" : "district"} size={14} />
                                  {initiative.scope === "city" ? "Весь город" : selectedDistrict.name_ru}
                                </span>
                              </div>
                              <h5>{initiative.name_ru}</h5>
                              <div className="effects">
                                {Object.entries(initiative.effects).map(([indicator, value]) => (
                                  <span className={value < 0 ? "negative" : ""} key={indicator}>
                                    <Icon name={value < 0 ? "risk" : "effect"} size={14} />
                                    <b>{catalog.indicators.find((item) => item.id === indicator)?.name_ru ?? indicator}</b>
                                    <strong>{signed(value)}</strong>
                                    <small title="Технический код показателя">{indicator}</small>
                                  </span>
                                ))}
                              </div>
                              <div className="initiative-facts">
                                <span><Icon name="clock" size={15} /> Эффект с {quarterLabel(initiative.lag_quarters)}</span>
                                <span className={negativeEffects.length > 0 ? "has-risk" : "no-risk"}>
                                  <Icon name={negativeEffects.length > 0 ? "risk" : "check"} size={15} />
                                  {negativeEffects.length > 0 ? "Есть компромисс" : "Нет снижения показателей"}
                                </span>
                              </div>
                              <div className="initiative-footer">
                                <strong><Icon name="budget" size={17} /> {initiative.cost} <small>ед.</small></strong>
                                <span className={selected ? "selected-button" : "add-button"}>
                                  <Icon name={selected ? "remove" : "plus"} size={16} />
                                  {selected ? "Убрать" : disabledReason || "Добавить"}
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>

              <dialog ref={dialogRef} className="results-dialog" aria-labelledby="results-title">
                <div className="results-dialog-header">
                  <h2 id="results-title">Результаты пяти сценариев</h2>
                  <button className="secondary-button icon-label" autoFocus onClick={() => dialogRef.current?.close()}><Icon name="remove" size={16} /> Закрыть</button>
                </div>
                {submitting && <p role="status">{progress} Это может занять несколько минут.</p>}
                {submitError && <p role="alert" className="error-card">{submitError} Закройте окно и повторите отправку.</p>}
                {comparison && result && <section className="comparison-overview" aria-label="Общий вывод по сценариям">
                  <p className="section-kicker">Общий вывод · {reportProviderLabel(comparison.provider)}</p>
                  <h3>{comparison.winner_indexes.length === 1 ? "Лучший сценарий" : "Лидеры с одинаковым результатом"}: {comparison.winner_indexes.map((index) => scenarios[index].name).join(", ")}</h3>
                  <p className="comparison-score">Индекс качества жизни: {comparison.best_score.toFixed(2)}</p>
                  <p>{comparison.conclusion}</p>
                  <h4>Почему этот результат</h4>
                  <ul>{comparison.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <h4>Что учесть перед выбором</h4>
                  <ul>{comparison.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>}
                {results.length > 0 && <h3>Подробный разбор каждого сценария</h3>}
                <div className="result-tabs">
                  {results.map((item, index) => item && <button key={index} aria-pressed={reportIndex === index} onClick={() => {
                    setEvidenceAdvice(null);
                    setReportIndex(index);
                    setResult(item);
                  }}>{scenarios[index].name} · {item.final_score.toFixed(2)}</button>)}
                </div>
              {result && (
                <>
                  <section className="result-panel">
                  <div className="result-score">
                    <p className="section-kicker">Сценарий рассчитан</p>
                    <strong>{result.final_score.toFixed(2)}</strong>
                    <span>{result.score_delta >= 0 ? "+" : ""}{result.score_delta.toFixed(2)} к исходному значению</span>
                  </div>
                  <div className="result-copy">
                    <div className="report-heading">
                      <h3>
                        Отчёт ИИ: индекс изменился на {result.score_delta >= 0 ? "+" : ""}
                        {result.score_delta.toFixed(2)} пункта
                      </h3>
                      <span className={`verdict ${result.explanation.verdict}`}>
                        {result.explanation.verdict === "improved" ? "Улучшение" : result.explanation.verdict === "mixed" ? "Смешанный результат" : "Ухудшение"}
                      </span>
                    </div>
                    <p>{result.explanation.summary}</p>
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
                    <div className="report-grid">
                      <div><strong>Что хорошо</strong><ul>{result.explanation.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div><strong>Риски</strong><ul>{result.explanation.risks.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div><strong>Компромиссы</strong><ul>{result.explanation.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div><strong>Следующий шаг</strong><ul>{result.explanation.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></div>
                    </div>
                    <p className="resource-report">{result.explanation.resource_assessment} · {reportProviderLabel(result.ai_provider)}</p>
                  </div>
                  </section>

                  <section className="city-report-panel">
                    <div className="section-heading city-report-heading">
                      <div>
                        <p className="section-kicker">Обоснование сценария</p>
                        <h3>Что выбрано, зачем это нужно и что известно о городе</h3>
                      </div>
                      <span className="rule-pill">После финального расчёта</span>
                    </div>

                    <div className="evidence-toolbar">
                      <div>
                        <p className="section-kicker">Официальная практика Астаны</p>
                        <h4>Проверка решений по официальным источникам</h4>
                        <p>
                          {evidenceStatus?.item_count
                            ? `В базе сохранено ${evidenceStatus.item_count} фактов с источниками. Они не меняют расчётный индекс.`
                            : "Обновите базу, чтобы сопоставить сценарий с официальными публикациями и статистикой."}
                        </p>
                      </div>
                      <button className="secondary-button" onClick={refreshEvidence} disabled={evidenceBusy}>
                        {evidenceBusy ? "Анализируем…" : evidenceStatus?.item_count ? "Обновить источники" : "Загрузить источники"}
                      </button>
                    </div>
                    {evidenceStatus?.updated_at && (
                      <p className="evidence-status">
                        Статус: {evidenceStatusLabels[evidenceStatus.status]} · обновлено {new Date(evidenceStatus.updated_at).toLocaleString("ru-RU")}
                      </p>
                    )}
                    {evidenceError && <div className="evidence-warning" role="alert">{evidenceError}</div>}

                    {evidenceAdvice && (
                      <div className="evidence-report">
                        <p className="evidence-disclosure">{evidenceAdvice.disclosure}</p>
                        <div className="evidence-digest">
                          <div><strong>Что подтверждается</strong><ul>{evidenceAdvice.city_digest.proven_patterns.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <div><strong>Сигналы осторожности</strong><ul>{evidenceAdvice.city_digest.caution_signals.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <div><strong>Пробелы данных</strong><ul>{evidenceAdvice.city_digest.evidence_gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        </div>
                        <div className="evidence-recommendations">
                          {evidenceAdvice.recommendations.map((recommendation) => {
                            const decision = result.report_context.selected_decisions.find((item) => item.initiative_id === recommendation.initiative_id);
                            return (
                              <article key={recommendation.initiative_id}>
                                <header>
                                  <div><small>{recommendation.initiative_id}</small><h5>{decision?.name_ru ?? recommendation.initiative_id}</h5></div>
                                  <span className={`assessment ${recommendation.assessment}`}>{assessmentLabels[recommendation.assessment]}</span>
                                </header>
                                <p>{recommendation.rationale}</p>
                                {recommendation.conditions.length > 0 && <ul className="evidence-conditions">{recommendation.conditions.map((item) => <li key={item}>{item}</li>)}</ul>}
                                <div className="source-list">
                                  {recommendation.evidence.map((source) => (
                                    <a href={source.url} target="_blank" rel="noreferrer" key={`${source.id}-${source.claim}`}>
                                      <span>{claimTypeLabels[source.claim_type]} · достоверность: {confidenceLabels[source.confidence]}</span>
                                      <strong>{source.title}</strong>
                                      <p>{source.claim}</p>
                                      <small>{source.publisher} · {source.published_at} ↗</small>
                                    </a>
                                  ))}
                                  {recommendation.evidence.length === 0 && <small className="no-source">Для этого решения в текущем кэше нет прямого источника.</small>}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="choice-explanations">
                      {result.report_context.selected_decisions.map((decision, index) => (
                        <article className="choice-explanation" key={decision.initiative_id}>
                          <div className="choice-index">{index + 1}</div>
                          <div className="choice-body">
                            <div className="choice-meta">
                              <span>{decision.initiative_id} · {decision.direction_name_ru}</span>
                              <span>{decision.target_name_ru}</span>
                            </div>
                            <h4>{decision.name_ru}</h4>
                            <p>{decision.rationale_ru}</p>
                            <div className="choice-effects">
                              {decision.realized_effects.map((effect) => (
                                <span className={effect.delta < 0 ? "negative" : ""} key={effect.indicator_id}>
                                  {effect.indicator_name_ru} {effect.delta >= 0 ? "+" : ""}{effect.delta.toFixed(2)}
                                </span>
                              ))}
                            </div>
                            <small>
                              {decision.cost} ед. · задержка эффекта {decision.lag_quarters} кв. · реализовано к концу периода {Math.round(decision.realized_fraction * 100)}%
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="city-knowledge-intro">
                      <div>
                        <p className="section-kicker">Что знает модель</p>
                        <h4>{catalog.city_context.mission_ru}</h4>
                        <p>{catalog.city_context.data_disclosure_ru}</p>
                      </div>
                      <ul>
                        {catalog.city_context.goals.map((goal) => <li key={goal}>{goal}</li>)}
                      </ul>
                    </div>

                    <div className="knowledge-section">
                      <h4>Состояние направлений до решений</h4>
                      <div className="direction-knowledge">
                        {catalog.city_context.baseline_snapshot.direction_scores.map((direction) => (
                          <div key={direction.direction_id}>
                            <span>{direction.name_ru}</span>
                            <strong>{direction.value.toFixed(1)}</strong>
                            <i><b style={{ width: `${direction.value}%` }} /></i>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="knowledge-section">
                      <h4>Потребности города до изменений</h4>
                      <p>Все показатели ниже порога внимания 55, начиная с самых слабых.</p>
                      <div className="city-needs-grid">
                        {catalog.city_context.baseline_snapshot.city_needs.map((need) => (
                          <span className={need.severity} key={`${need.district_id}-${need.indicator_id}`}>
                            <small>{need.severity === "critical" ? "Критично" : "Внимание"} · {need.district_name_ru}</small>
                            <strong>{need.value.toFixed(0)}</strong>
                            <em>{need.name_ru}</em>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="knowledge-section">
                      <h4>Профиль каждого района</h4>
                      <div className="district-knowledge-grid">
                        {catalog.city_context.baseline_snapshot.districts.map((district) => (
                          <article key={district.district_id}>
                            <header><strong>{district.name_ru}</strong><span>{district.score.toFixed(2)}</span></header>
                            <p>{district.profile_ru}</p>
                            <small>Нужно усилить</small>
                            <ul>
                              {district.priority_indicators.length > 0
                                ? district.priority_indicators.map((indicator) => <li key={indicator.indicator_id}>{indicator.name_ru}: {indicator.value.toFixed(0)}</li>)
                                : <li>Нет показателей ниже 55</li>}
                            </ul>
                            <small>Сильные стороны</small>
                            <ul>
                              {district.strong_indicators.length > 0
                                ? district.strong_indicators.map((indicator) => <li key={indicator.indicator_id}>{indicator.name_ru}: {indicator.value.toFixed(0)}</li>)
                                : <li>Нет показателей от 70</li>}
                            </ul>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                </>
              )}
              </dialog>
            </div>

            <BudgetPanel
              catalog={catalog}
              scenario={activeScenario}
              initiatives={initiatives}
              validation={validation}
              result={null}
              onRemove={removeInitiative}
              onComplete={completeScenario}
              completeDisabled={!validation?.valid || confirming || submitting || isCompleted(activeIndex)}
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
