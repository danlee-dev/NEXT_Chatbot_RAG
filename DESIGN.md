# Stack Sage — Design System

AI 코딩 도구 메타 어드바이저 챗봇의 디자인 소스 오브 트루스.
모든 컬러/타이포/스페이싱/모션은 여기 정의를 따른다. 코드는 항상 semantic token으로 작성한다.

## 1. Reference

- **Linear** — 다크 우선, 무채색 + 단일 보라 액센트, 정밀한 키보드 인터랙션, 얇은 hairline border
- **Notion** — 콘텐츠 중심 레이아웃, 넉넉한 reading rhythm, subtle hover state, 본문 typography
- **Figma** — 좌측 navigation + 중앙 canvas + 우측 inspector 3-panel, 깔끔한 작은 컨트롤, neutral chrome

## 2. Principles

1. **Calm by default** — 그라데이션·glow·반투명 layer 남발 X. Information density가 우선.
2. **Hairline over heavy** — border `1px` 0.06 alpha, shadow는 hover/active에만.
3. **Mono for facts** — 인용 번호 [1], 도구 이름, 코드, URL은 mono 폰트.
4. **Dark first, light parity** — 다크에서 디자인하고 light는 paired token.
5. **Citation as first-class UI** — `[1]` 인용은 단순 텍스트가 아닌 클릭 가능 chip.

## 3. Color Tokens

CSS variables. light/dark 한 쌍으로만 정의. semantic 이름만 사용 (hex 노출 X).

### Light (`:root`)
```
--bg              #FAFAF9   /* canvas (warm zinc-50) */
--bg-elevated     #FFFFFF   /* surfaces, cards */
--bg-subtle       #F4F4F2   /* sidebars, code bg */
--fg              #18181B   /* primary text */
--fg-muted        #52525B   /* secondary text */
--fg-subtle       #A1A1AA   /* tertiary, hints */
--border          rgba(0,0,0,0.08)
--border-strong   rgba(0,0,0,0.14)
--accent          #6E56CF   /* Linear violet */
--accent-fg       #FFFFFF
--accent-subtle   rgba(110,86,207,0.10)
--success         #10B981
--warning         #F59E0B
--danger          #EF4444
--ring            rgba(110,86,207,0.45)
```

### Dark (`[data-theme="dark"]`, default)
```
--bg              #0B0B0E
--bg-elevated     #131318
--bg-subtle       #1A1A20
--fg              #ECECEE
--fg-muted        #A1A1AA
--fg-subtle       #71717A
--border          rgba(255,255,255,0.07)
--border-strong   rgba(255,255,255,0.12)
--accent          #8B7BD8
--accent-fg       #0B0B0E
--accent-subtle   rgba(139,123,216,0.14)
--success         #34D399
--warning         #FBBF24
--danger          #F87171
--ring            rgba(139,123,216,0.5)
```

## 4. Typography

- **Sans**: Inter (variable). Fallback: system-ui.
- **Mono**: JetBrains Mono / SF Mono / ui-monospace.
- 한국어는 Inter 가 cyrillic/cjk 다 cover. 부족하면 `Pretendard Variable` 추가 가능.

Scale (rem 기반, 1rem=16px):
| token | size | line | use |
|---|---|---|---|
| `text-xs`  | 0.75  | 1.5 | helper, footnote, source meta |
| `text-sm`  | 0.875 | 1.6 | UI default, message body |
| `text-base`| 1.0   | 1.6 | input |
| `text-lg`  | 1.125 | 1.4 | section title |
| `text-xl`  | 1.375 | 1.3 | character name |

## 5. Spacing

8px grid. `1, 2, 3, 4, 6, 8, 12, 16, 24` (px=4×n). 컴포넌트 내부는 `8/12/16`, 컴포넌트 간은 `16/24`.

## 6. Radius

- `r-sm: 6px` — chip, badge, button
- `r-md: 10px` — input, source card
- `r-lg: 14px` — main panels, modal
- `r-pill: 999px` — citation chip

## 7. Shadows

다크 우선 환경이라 그림자 거의 안 씀. modal/floating panel에만:
- `shadow-soft`: `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)` (light)
- `shadow-soft-dark`: `0 8px 32px rgba(0,0,0,0.55)` (dark)

## 8. Layout (3-panel, Figma-inspired)

데스크톱 (≥1024px):
```
┌─ Nav (240px) ─┬─ Main ──────────┬─ Inspector (320px) ─┐
│ Sage logo      │  message list   │  Sources           │
│ Catalog        │  ────────────── │  Rewrite trace     │
│ Session sources│  input          │                    │
└────────────────┴─────────────────┴────────────────────┘
```

모바일 (<1024px):
- Nav/Inspector 가 sheet 로 변형. 기본은 Main 만 노출.
- 하단 tab bar 로 (Chat / Sources / Catalog) 전환.

## 9. Motion

빠르고 절제. duration max `180ms`, easing `cubic-bezier(0.16, 1, 0.3, 1)` (linear-ish out-expo).
- hover bg: `120ms`
- 메시지 등장: `180ms` opacity + 4px translateY
- citation chip 클릭 → inspector scroll: `220ms`
- typing dots: `1.2s` infinite

## 10. Component Specifics

### Citation chip `[1]`
- 본문 안에 inline. radius `r-pill`, padding `0 6px`, height `18px`.
- bg `--accent-subtle`, fg `--accent`, mono font, `text-xs`.
- hover: `--accent-subtle` 1.5× alpha. 클릭 → inspector 해당 source에 scroll + highlight 1.5s.

### Source card (Inspector)
- bg `--bg-elevated`, border `--border`, radius `r-md`, padding `12px 14px`.
- header row: badge (source-tag) + small URL host (mono, `--fg-subtle`)
- body: 첫 줄 truncate 3줄. 클릭 → expand.
- highlighted state: border `--accent`, bg `--accent-subtle`.

### Message bubble
- user: 우측 정렬, bg `--accent`, fg `--accent-fg`, radius `r-lg` (오른쪽 아래만 `r-sm`).
- assistant: 좌측 정렬, bg `--bg-elevated`, fg `--fg`, border `--border`.
- 본문 안에서 `[N]` 패턴을 citation chip 으로 자동 변환.

### Input bar
- container: bg `--bg-elevated`, border `--border-strong`, radius `r-lg`, padding `12px`.
- textarea: borderless, transparent bg, focus 시 outer ring `--ring`.
- 우측 send button: square 36px, accent. disabled 시 `--bg-subtle`.

### Sidebar Nav item
- height 32px, padding `0 10px`, radius `r-sm`.
- idle: fg `--fg-muted`. hover: bg `--bg-subtle`. active: bg `--accent-subtle` fg `--accent`.

## 11. Accessibility

- Contrast: 본문 4.5:1 +, UI 3:1 + (WCAG AA). dark/light 둘 다 검증.
- Focus ring `--ring` 2px outline, never remove.
- 모든 인터랙티브 element에 `aria-label`. citation chip은 `aria-label="source 1, click to inspect"`.

## 12. Don'ts

- ~~glass morphism~~ (frosted blur layer)
- ~~rainbow / gradient accent~~ — accent는 violet 한 가지
- ~~heavy box-shadow~~
- ~~border on every card~~ — hairline 만, 필요 없으면 생략
- ~~Pacifico, Comic Sans 류 장식 폰트~~
