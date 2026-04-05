# My3DFarm

## Архитектура

- **Frontend**: React + **Tailwind CSS** + **Framer Motion**
- **UI primitives**: **Radix UI** (a11y) + кастомный glass-стиль
- **Иконки**: **lucide-react**
- **Backend**: Tauri (Rust) для нативного слоя
- **State**: Zustand
- **API**: `fetch` к Moonraker с **таймаутом ~10 с**

## Целевые платформы

- **Основная**: **Windows** — под неё в первую очередь проектируем UX и проверяем поведение.
- **Сборки**: дополнительно **macOS (Apple Silicon)** и **Linux** — **Debian 12+** в окружении **GNOME** (сборки и smoke-тесты под эти цели).

## Визуальный рулбук (Liquid Glass / iOS-style)

- **Дизайн-система**: полупрозрачные слои, `backdrop-blur-xl`, токены светлой/тёмной темы (accent iOS blue, success/warning из рулбука).
- **Темы**: `system | light | dark` в localStorage + `prefers-color-scheme`; все цвета через **CSS variables** (`:root` / `.dark`).
- **Анимации**: Framer Motion — fade + slide-up, cross-fade между экранами, scale 0.98 на тап; hover карточек — `-translate-y-0.5` и сильнее тень.
- **Размеры**: карточки 20px radius, кнопки 12px, модалки 24px; сайдбар **260px**.
- **Компоненты по стилю**: `PrinterCard` (стекло, индикатор статуса, offline-состояние), стеклянный **Sidebar**, `StatusBadge` с пульсом при печати.
- **i18n**: react-i18next, языки `ru, en, de, zh`, **по умолчанию и fallback — `en`**, namespaces `common`, `printer`, `settings`, `errors`; `Trans`, плейсхолдеры, плюрализация.

Полная таблица токенов, Tailwind extensions и чеклисты — в `.cursor/rules/my3dfarm.mdc`.

## Первые компоненты для разработки

1. `PrinterCard` — имя, статус, версии Klipper/Moonraker, стекло + индикатор
2. `PrinterList` — список принтеров, адаптивная сетка (1 / 2 / 3–4 колонки)
3. `MoonrakerClient` — запросы к `/machine`, `/printer`, `/server/info`

## Moonraker API

Полная спецификация HTTP API (методы, параметры, JSON): [Moonraker external API](https://moonraker.readthedocs.io/en/latest/external_api/).

### Endpoints (сначала)

- `GET /server/info` — версии Moonraker, Klipper
- `GET /printer/objects/query?webhooks` — статус (printing, idle, error)
- `GET /machine/system_info` — CPU, температура, память
- `POST /server/restart` — перезапуск Klipper
- `GET /machine/update/status` — обновления ПО

## Конфигурация Klipper

Справочник по `printer.cfg` — секции, параметры, пины, MCU, кинематика, нагреватели, TMC и т.д.:

- [Klipper configuration reference](https://www.klipper3d.org/Config_Reference.html)

## CAN bus и обслуживание принтеров

Настройка CAN, прошивка плат (mainboard / toolhead), Katapult, обновление уже работающей CAN-системы и типовые проблемы — по обобщённому гайду:

- [Esoterical’s CANBus Guide](https://canbus.esoterical.online/)

## Формат ответов

Все ответы — **JSON**; типизировать в TypeScript.
