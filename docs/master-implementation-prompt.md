# HACKALEM AI — MASTER IMPLEMENTATION PROMPT

Ты работаешь как мой senior full-stack engineer, AI engineer и technical copilot
над SOLO-проектом пятичасового GovTech-хакатона.

PROJECT:
«Аким на 5 часов» — AI-симулятор управления городом.

Я работаю одна.

Главная цель:
за минимальное время получить полностью рабочий, понятный и устойчивый MVP,
который можно показать жюри end-to-end.

Приоритеты в таком порядке:

1. Работоспособность.
2. Полный пользовательский сценарий.
3. Детерминированная и объяснимая бизнес-логика.
4. Хороший UX для демонстрации.
5. AI, который реально добавляет ценность.
6. README и воспроизводимость.
7. Дополнительные функции — только если всё выше готово.

Критерии хакатона:

- Работоспособность — 25
- Техническая реализация — 25
- README и воспроизводимость — 25
- Ценность — 15
- Потенциал и оригинальность — 10

Не переусложняй архитектуру.

==================================================
0. СНАЧАЛА ИЗУЧИ REPOSITORY
==================================================

Перед изменениями:

1. Осмотри существующий repository.
2. Определи используемый stack.
3. Найди существующие UI components, API routes, styles и utilities.
4. Проверь package.json и текущие зависимости.
5. Проверь существующие environment variables.
6. Проверь, есть ли backend/server layer.
7. Проверь существующую AI integration.
8. Не заменяй работающий stack без необходимости.

Если repository пустой:
используй самый быстрый поддерживаемый вариант React + TypeScript.

Не добавляй тяжёлую инфраструктуру.

Не нужны без явной необходимости:

- Kubernetes
- Docker orchestration
- microservices
- Kafka
- Redis
- vector DB
- отдельные сервисы
- сложная authentication
- отдельная database

Для MVP localStorage достаточно для сценариев.

==================================================
1. PRODUCT CONCEPT
==================================================

Пользователь — аким условного города.

Он получает одинаковое исходное состояние города и должен создать
ПЯТЬ альтернативных сценариев развития.

ВАЖНО:

Каждый сценарий имеет собственные 100 coin.

Это НЕ общий бюджет 500 coin.

Все сценарии стартуют с одного и того же baseline.

Результат одного сценария не влияет на остальные.

Каждый сценарий содержит ровно ПЯТЬ решений —
по одному в каждом направлении:

1. Транспорт
2. Озеленение
3. Социальная инфраструктура
4. Безопасность
5. Городские сервисы

Для каждого направления существует несколько мероприятий.

Каждое мероприятие содержит:

- id
- название
- краткое описание
- стоимость в coin
- затрагиваемые условные районы
- положительные эффекты
- возможные trade-offs
- числовые изменения показателей

Пользователь выбирает одно мероприятие из каждой категории.

TOTAL COST <= 100.

Неиспользованные coin = резерв.

==================================================
2. SYNTHETIC DATA POLICY
==================================================

Для MVP используй небольшой фиксированный воспроизводимый synthetic dataset.

Никаких random values при reload.

Очень явно показывай:

«Синтетические данные для демонстрации модели»

Не представляй значения как официальную статистику Астаны.

Не создавай географически точную карту Астаны без реальных GIS-данных.

Используй:

- карточки условных районов;
- schematic city view;
- abstract visualization.

Вынеси отдельно:

src/config/city.ts
src/config/interventions.ts
src/config/scoring.ts

или эквивалентные файлы существующего проекта.

==================================================
3. USER FLOW
==================================================

Обязательный путь:

ГОРОД
↓
5 СЦЕНАРИЕВ
↓
5 РЕШЕНИЙ В КАЖДОМ
↓
КОНТРОЛЬ БЮДЖЕТА
↓
QUALITY OF LIFE SCORE
↓
СРАВНЕНИЕ
↓
AI ANALYSIS

Сначала реализуй именно этот путь.

==================================================
4. SCREEN 1 — «ВАШ ГОРОД СЕГОДНЯ»
==================================================

Главный заголовок:

«Вы — аким на 5 часов»

Подзаголовок:

«Изучите потребности районов → примите 5 решений →
создайте 5 вариантов бюджета → получите сравнение и рекомендации AI»

Покажи:

Бюджет:
100 coin

Пять baseline city indicators.

Например:

Транспорт
Озеленение
Социальная инфраструктура
Безопасность
Городские сервисы

Все indicators:
0–100.

Покажи карточки условных районов:

- текущие показатели;
- основные проблемы;
- наиболее слабые направления.

Обязательно badge:

«Синтетические данные • Demo model»

CTA:

«Начать планирование»

==================================================
5. SCREEN 2 — SCENARIO BUILDER
==================================================

Заголовок:

«Соберите сценарий»

Tabs:

Сценарий 1
Сценарий 2
Сценарий 3
Сценарий 4
Сценарий 5

Для каждого:

«Решений принято: X/5»

Основная область содержит пять cards:

Транспорт
Озеленение
Социальная инфраструктура
Безопасность
Городские сервисы

Каждая card показывает:

- исходную проблему;
- несколько мероприятий;
- стоимость;
- затрагиваемые районы;
- ожидаемый плюс;
- возможный минус/trade-off.

Selection должен обновлять интерфейс мгновенно.

==================================================
6. BUDGET PANEL
==================================================

Справа на desktop сделай sticky panel.

На mobile она должна нормально перестраиваться.

Показывай:

БЮДЖЕТ
100 coin

Потрачено:
XX

Резерв:
XX

Progress bar.

Также:

✓ выбранные решения
✓ preliminary Quality of Life Score

Если новое мероприятие приведёт к:

total > 100

НЕ принимай выбор.

Покажи понятную ошибку:

«Это решение превышает бюджет сценария на X coin.
Выберите более доступное мероприятие или измените другое решение.»

==================================================
7. SCENARIO MANAGEMENT
==================================================

Пользователь может:

- переименовать сценарий;
- сбросить сценарий;
- скопировать предыдущий сценарий.

ВАЖНО:

Копия НЕ считается уникальным сценарием.

Она становится новым сценарием только после изменения минимум одного решения.

Перед сравнением проверить:

- 5 сценариев существуют;
- каждый содержит 5 решений;
- каждый <= 100 coin;
- все 5 сценариев различаются.

Показывай конкретную ошибку возле проблемного сценария.

==================================================
8. QUALITY OF LIFE SCORE
==================================================

Score рассчитывается ТОЛЬКО deterministic application logic.

LLM НЕ рассчитывает Score.

Если утверждённой формулы в repository нет, используй
простую documented demo model.

Baseline:

district × 5 indicators

Все значения:
0–100.

После выбранных мероприятий применяются фиксированные effects.

Clamp:

0 <= indicator <= 100

Затем:

1. вычисли показатели каждого района после решений;
2. вычисли среднее каждого направления по районам;
3. вычисли среднее пяти направлений.

Используй равные веса:

Score =
(
 Transport
 + Green
 + Social
 + Safety
 + CityServices
) / 5

Score должен быть reproducible.

Никакой случайности.

В UI добавь:

«Как рассчитан Score?»

с коротким объяснением формулы.

==================================================
9. WINNER SELECTION
==================================================

После пяти valid unique scenarios:

кнопка

«Сравнить сценарии»

становится активной.

Winner определяется кодом:

1. highest Score;
2. если Score одинаковый → lower spending;
3. если и spending одинаковый → earlier saved scenario.

ВАЖНО:

Не называй победителя:

«оптимальным решением для Астаны».

Используй формулировки:

«Лучший результат среди пяти смоделированных сценариев»

или

«Сценарий с наибольшим Score среди ваших пяти вариантов».

==================================================
10. SCREEN 3 — COMPARISON
==================================================

Заголовок:

«Сравнение пяти решений акима»

Покажи все пять сценариев рядом.

Для каждого:

- название;
- расходы;
- резерв;
- 5 мероприятий;
- final Score;
- delta относительно baseline.

Highlight winner.

Добавь:

«Посмотреть детали сценария»

и покажи:

BEFORE → AFTER

по каждому indicator.

==================================================
11. AI ANALYSIS
==================================================

AI НЕ принимает решение о winner.

AI получает уже рассчитанные результаты.

AI должен объяснить:

1. почему выбранный кодом сценарий лидирует;
2. какие показатели улучшились;
3. какие районы получили эффект;
4. слабые места;
5. риски;
6. trade-offs;
7. какое изменение стоит проверить следующим.

AI не должен:

- менять Score;
- придумывать новые показатели;
- менять budget;
- придумывать official city facts;
- объявлять сценарий объективно оптимальным.

==================================================
12. AVAILABLE HACKATHON AI RESOURCES
==================================================

Доступны hackathon resources:

- $50 OpenAI API credits
- $50 NVIDIA API Tokens
- ChatGPT + Codex Pro hackathon access

Считай API credits ограниченным ресурсом.

НЕ пытайся специально использовать весь кредит.

Оптимизируй calls.

==================================================
13. AI RESOURCE POLICY
==================================================

LEVEL 0 — NO AI

Используй normal TypeScript/application logic для:

- arithmetic;
- budget validation;
- Score;
- comparison;
- sorting;
- winner selection;
- normalization;
- scenario validation;
- UI state.

Cost = $0.

LEVEL 1 — AI COMPARISON

После создания всех пяти сценариев:

сделай ОДИН AI request для анализа всех пяти.

НЕ делай пять отдельных requests.

LEVEL 2 — OPTIONAL

Дополнительный request только если пользователь явно нажимает:

«Объяснить подробнее»

или аналогичную функцию.

Не вызывай AI:

- при движении slider;
- при каждом выборе;
- при каждом render;
- при calculation Score.

==================================================
14. AI API
==================================================

Создай:

analyzeScenarios(...)

Если repository уже содержит server AI endpoint:
используй его.

Если нет:
добавь минимальный:

POST /api/analyze

API KEY хранится ТОЛЬКО server-side.

Например:

OPENAI_API_KEY=

Никогда не помещай key:

- в frontend;
- repository;
- client bundle.

Добавь:

.env.example

без реального ключа.

==================================================
15. AI REQUEST
==================================================

Не отправляй весь frontend state.

Отправляй compact structured JSON.

Пример:

{
  "budget": 100,
  "baselineScore": 54.2,

  "scenarios": [
    {
      "id": 1,
      "name": "Сбалансированный рост",
      "spent": 92,
      "reserve": 8,
      "score": 68.4,

      "indicators": {
        "transport": 70,
        "green": 61,
        "social": 69,
        "safety": 72,
        "services": 70
      },

      "delta": {...},

      "decisions": [...]
    }
  ],

  "winnerId": 3
}

AI receives winnerId.

AI does NOT select it.

==================================================
16. STRUCTURED AI RESPONSE
==================================================

Запрашивай structured response:

{
  "leaderExplanation": "...",

  "strengths": [
    "..."
  ],

  "risks": [
    "..."
  ],

  "tradeoffs": [
    "..."
  ],

  "recommendations": [
    "..."
  ]
}

1–2 recommendations maximum.

Validate response before displaying.

Do not display statements contradicting deterministic results.

==================================================
17. AI FAILURE MODE
==================================================

Приложение ОБЯЗАНО работать без API.

Если:

OPENAI_API_KEY missing

или:

API timeout / error / quota exceeded

весь simulator продолжает работать.

Покажи:

«AI-анализ недоступен: настройте API-ключ»

И отдельно:

«Автоматический расчёт»

с deterministic explanation.

НЕ называй fallback AI analysis.

==================================================
18. NVIDIA
==================================================

Do NOT delay MVP in order to integrate NVIDIA.

Primary goal:

working OpenAI integration + deterministic fallback.

Only after the full mandatory flow works:

consider NVIDIA integration.

If it can be added quickly and meaningfully,
implement it behind the same analyzeScenarios interface.

Possible future config:

AI_PROVIDER=openai
AI_PROVIDER=nvidia

But do not build unnecessary abstraction before the MVP works.

==================================================
19. COST OPTIMIZATION
==================================================

Follow these rules:

- one comparison call for 5 scenarios;
- compact JSON;
- short structured output;
- cache identical scenario analysis;
- never call AI automatically while editing;
- use deterministic calculations locally;
- timeout AI requests;
- avoid unnecessary retries.

If easy to implement, create a hash from scenario input.

If the same scenario combination is analyzed again,
reuse cached response.

==================================================
20. DESIGN
==================================================

Style:

modern GovTech analytical dashboard.

Visual direction:

- light background;
- dark navy headings;
- turquoise accent;
- clean cards;
- clear information hierarchy;
- restrained charts;
- professional, not game-like.

The 100 coin metaphor can be visually friendly,
but the product should still feel like a serious decision-support system.

Language:
Russian.

Responsive:

- laptop first;
- mobile usable.

Accessibility:

- keyboard accessible controls;
- proper labels;
- visible focus states;
- sufficient contrast.

Do not waste hackathon time on excessive animation.

==================================================
21. LOCAL PERSISTENCE
==================================================

Persist scenarios locally.

Use localStorage unless existing stack already provides something appropriate.

Reloading page must NOT destroy demo progress.

Provide:

«Начать заново»

with confirmation.

==================================================
22. README
==================================================

README must contain:

# Аким на 5 часов

## Concept

## Problem

## Solution

## Architecture

## Running locally

## Environment variables

## Synthetic dataset

Explicitly state that city indicators are synthetic demo data.

## Quality of Life Score

Explain exact formula.

## AI role

Explain:

Deterministic engine = calculations.

LLM = interpretation/explanation.

## AI resource usage

Explain why AI calls are minimized.

## Demo flow

Provide a 2–3 minute jury demo sequence.

## Limitations

Mention synthetic dataset and absence of official city simulation validation.

==================================================
23. TESTING
==================================================

Manually verify:

TEST 1
Five scenarios can be completed.

TEST 2
Each requires exactly five decisions.

TEST 3
Budget >100 is impossible.

TEST 4
Unused budget becomes reserve.

TEST 5
Changing intervention changes Score predictably.

TEST 6
Copied identical scenario is rejected as duplicate.

TEST 7
Five unique scenarios enable Compare.

TEST 8
Highest Score wins.

TEST 9
Tie breaker works.

TEST 10
Reload preserves state.

TEST 11
No API key → application still works.

TEST 12
AI failure → deterministic comparison remains visible.

TEST 13
No secrets appear in frontend bundle/repository.

==================================================
24. SECURITY
==================================================

Never commit:

.env
.env.local
API keys
tokens
credentials

Check .gitignore.

Provide .env.example.

Before every commit:
check staged files for secrets.

==================================================
25. GIT STRATEGY
==================================================

Do not create one giant commit.

Use logical milestones.

Suggested sequence:

1.
chore: initialize simulator structure

2.
feat: add synthetic city dataset

3.
feat: implement five-scenario planning flow

4.
feat: add budget validation and scenario controls

5.
feat: implement deterministic quality of life score

6.
feat: add five-scenario comparison dashboard

7.
feat: add server-side AI scenario analysis

8.
feat: add offline fallback and local persistence

9.
docs: add hackathon README and demo guide

You may adapt this sequence to the existing repository.

After each meaningful milestone:

- run build;
- run lint if available;
- run tests if available;
- commit only working code.

==================================================
26. SOLO HACKATHON RULE
==================================================

Assume ONE developer and FIVE HOURS.

Whenever you consider adding something, ask:

"Does this materially improve the jury demo or evaluation score?"

If no:
do not build it yet.

Do NOT prioritize:

- authentication;
- database;
- admin panel;
- multiplayer;
- leaderboard;
- elaborate animations;
- PDF export;
- real-time events;
- GIS;
- RAG;
- agent orchestration

before mandatory MVP is complete.

==================================================
27. OPTIONAL FEATURES
==================================================

ONLY if mandatory flow is finished and stable:

Priority A:
better charts / visualization.

Priority B:
NVIDIA provider.

Priority C:
unexpected city event simulation.

Priority D:
presentation/export mode.

Do not start these before mandatory requirements pass.

==================================================
28. CODEX WORKING STYLE
==================================================

Work independently.

Do not stop after every minor decision to ask me questions.

If something is unspecified:
choose the simplest reasonable implementation and document the assumption.

However, before making a MAJOR architectural change,
explain why it is necessary.

Keep code understandable for a product-oriented solo participant.

For important modules add concise comments explaining:

- what this file does;
- inputs;
- outputs;
- important business rule.

==================================================
29. IMPLEMENTATION ORDER
==================================================

Work in this exact priority:

PHASE 1 — CORE

Synthetic dataset
↓
scenario state
↓
5 decisions
↓
budget validation
↓
Score

PHASE 2 — UX

Scenario tabs
↓
budget panel
↓
validation
↓
localStorage

PHASE 3 — COMPARISON

5 scenario validation
↓
winner selection
↓
comparison UI
↓
before/after details

PHASE 4 — AI

/api/analyze
↓
OpenAI
↓
structured validation
↓
fallback

PHASE 5 — POLISH

responsive
↓
README
↓
demo testing
↓
visual polish

==================================================
30. FIRST ACTION
==================================================

Start by inspecting the repository.

Briefly report:

- current stack;
- current structure;
- reusable components;
- what already works;
- what is missing.

Then create a short implementation plan.

After that proceed with implementation.

Do not spend excessive time planning.

The goal is a WORKING MVP.

==================================================
31. DEFINITION OF DONE
==================================================

The project is DONE when I can:

1. open the application;
2. see city baseline;
3. click «Начать планирование»;
4. create Scenario 1;
5. make exactly 5 decisions;
6. see budget and Score update;
7. repeat for 5 scenarios;
8. see validation prevent invalid scenarios;
9. click «Сравнить сценарии»;
10. see all five compared;
11. see the highest-scoring user scenario highlighted;
12. understand why it scored higher;
13. receive AI explanation when API is available;
14. still complete the demo without AI API;
15. reload without losing progress.

Once this works:

STOP adding architecture.

Run final checks.

Then report to me:

READY FOR DEMO

and provide:

- what was implemented;
- how to run it;
- environment variables;
- where synthetic data lives;
- Score formula;
- AI integration status;
- known limitations;
- exact 2-minute demo flow for the jury.
