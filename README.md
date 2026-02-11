# Code Proxy 前端管理后台（首版）

基于 `React 19.2 + Vite + Bun + Tailwind CSS v4 + oxlint + oxfmt` 的后台项目。

当前已完成：

- 登录页（支持 API 地址与管理密钥登录）
- 鉴权守卫与会话恢复
- 后台布局（侧边栏 + 顶栏）
- 监控中心（KPI + 渠道统计 + 模型统计）
- 与参考项目一致的管理 API 前缀：`/v0/management`

## 启动

```bash
bun install
bun run dev
```

## 构建与检查

```bash
bun run lint
bun run format
bun run build
```

## 目录结构

```text
src/
  app/               # 路由与守卫
  lib/               # 常量、连接处理、HTTP 客户端与 API
  modules/
    auth/            # 鉴权 Provider
    layout/          # 后台布局
    login/           # 登录页
    monitor/         # 监控中心
    ui/              # 复合 UI 容器
  styles/            # 全局样式与主题变量
```

## 接口对齐说明

- API 基址自动规范为：`{apiBase}/v0/management`
- 登录校验：`GET /config`
- 监控数据：`GET /usage`
- 渠道映射：
  - `GET /openai-compatibility`
  - `GET /gemini-api-key`
  - `GET /claude-api-key`
  - `GET /codex-api-key`
  - `GET /vertex-api-key`
