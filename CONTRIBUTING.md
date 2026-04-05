# Участие в проекте

## Conventional Commits и Semver

Коммиты в `main` желательно оформлять по [Conventional Commits](https://www.conventionalcommits.org/) (английские типы — так проще автоматике и линтерам).

Формат одной строки заголовка:

```text
<type>(<scope>): <краткое описание>
```

Примеры:

- `feat(printer): add discovery timeout setting`
- `fix(moonraker): handle empty API key`
- `chore(ci): add release workflow`

### Как тип коммита влияет на версию (Semver)

После накопления изменений [Release Please](https://github.com/googleapis/release-please) открывает **Release PR**: в нём обновляются `CHANGELOG.md`, версия в `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`. После **мержа этого PR** создаётся **Git tag** вида `v0.2.0` и **GitHub Release**.

| Тип коммита | Обычный смысл (после `1.0.0`) | До `1.0.0` (настройки репозитория) |
|-------------|--------------------------------|-------------------------------------|
| `fix`, `perf`, исправления в `refactor` | **PATCH** `x.y.Z` | **PATCH** (при `bump-patch-for-minor-pre-major`) |
| `feat` | **MINOR** `x.Y.z` | **PATCH** вместо minor |
| `BREAKING CHANGE` в теле коммита **или** `!` после типа (`feat!:`) | **MAJOR** `X.y.z` | **MINOR** вместо major (`bump-minor-pre-major`) |

Не попадают в расчёт версии (но могут попасть в changelog как прочее): `chore`, `docs`, `style`, `test`, `ci` и т.п., **если** они не помечены как breaking.

Итог: «насколько поднять версию» задаётся **характером изменений** (ломаем контракт / новая возможность / исправление), а не числом файлов в коммите.

### Breaking change

Вариант 1 — восклицательный знак в заголовке:

```text
feat(api)!: drop legacy printer payload shape
```

Вариант 2 — футер:

```text
feat(api): new printer payload

BREAKING CHANGE: field "host" renamed to "address"
```

### Ручной номер версии в Release PR

Если нужно выставить версию явно, добавьте коммит с сообщением:

```text
chore: release 0.5.0

Release-As: 0.5.0
```

(подставьте нужный semver.)

### Если первый Release PR тянет слишком длинную историю

В `release-please-config.json` один раз можно задать верхний уровень `"bootstrap-sha": "<полный SHA>"` — коммиты **старше** этого SHA не учитываются при сборке заметок. После успешного первого релиза строку обычно удаляют.

## Локальная проверка

```bash
npm run test
npm run test:all   # перед релизным мержем по возможности
```

## Ссылки

- [Release Please](https://github.com/googleapis/release-please) — как устроены Release PR и теги
- [Semver](https://semver.org/lang/ru/)
