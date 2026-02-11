<INSTRUCTIONS>
你必须严格遵守以下前端样式规范：

1. 禁止任何“原生 CSS”写法
   - 不允许新增/修改任何自定义 CSS 选择器（如 `.xxx {}`、`:root {}`、`@media`、`@keyframes`、`::view-transition-*` 等）。
   - 不允许使用 CSS 变量方案来实现主题（如 `var(--xxx)`、`.dark { --xxx: ... }`）。
   - 不允许使用独立的 CSS Modules / SCSS / LESS。
   - 不允许使用任何内联样式（如 JSX 的 `style={{ ... }}`）或注入 `<style>` 标签。

2. 只允许使用 Tailwind CSS v4
   - 所有样式必须通过 Tailwind v4 的 utility class 在 JSX/TSX 的 `className` 中完成。
   - light / dark 主题必须使用 Tailwind v4 的 `dark:` 变体实现。
   - 主题切换仅允许通过给 `html`（或 `body`）切换 `dark` class 来驱动 `dark:` 变体。

3. 前端交互：最小变化原则（必须遵守）
   - UI 更新应尽量“局部更新”，避免不必要的整块重渲染/整页重排（例如：刷新数据时不要通过 `key` 强制 remount 整个列表/面板）。
   - Loading 状态必须与真实异步生命周期绑定：请求开始即进入 loading，请求结束（成功或失败）立刻退出 loading。
   - 避免视觉跳动：对数值展示使用 `tabular-nums`，必要时为按钮/数值容器设置稳定宽度（`min-w-*` 等），并避免文案切换导致布局抖动。
   - 动效必须克制且可降级：默认使用 `motion-safe:`，并尊重 `prefers-reduced-motion`（`motion-reduce:`）。

4. 全局样式文件限制
   - 项目允许保留一个 Tailwind 入口 CSS 文件（例如 `src/styles/index.css`），其内容只允许包含 Tailwind v4 指令（例如 `@import "tailwindcss";`、`@custom-variant ...`、`@theme ...`）。
   - 该文件不得包含任何自定义选择器与原生 CSS 规则。
     </INSTRUCTIONS>
