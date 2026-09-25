# SvelteCMS 插件模板

从零到发布一个 SvelteCMS 插件的起点。  
**clone即用，一条命令起一切**：
框架自动装配进仓内 `.sveltecms/`（gitignore，不用管），`pnpm dev` 起完整站点并热挂载你的插件。

## 三步上手

```bash
# 1. 改名为你的插件（标识符全量替换：manifest.name / 路由 / 菜单 / 表名 / slug）
node scripts/rename.mjs hello-world

# 2. 装本仓依赖
pnpm install

# 3. 起！首次自动 clone 框架并装配 .sveltecms/（慢几分钟，之后增量），
#    然后完整站点 + 你的插件，改动秒级热更新
pnpm dev
```

打开 http://localhost:5179 ——进 `/admin` 首次注册用户即管理员，侧栏
「插件管理 → hello-world」启用它。之后改 `plugin/` 下代码：组件与前端模块
HMR 即时生效；插件服务端代码（api/plugin.ts，SSR import 链）不随文件同步
热重载——后台「插件管理 → 重载」或重启 dev 即可。

还要做：中文文案与 icon 自行改（rename 脚本刻意不动自然语言）；用不到的
示例删掉（每个示例都有 `[示例·…]` 注释标记）。

## 仓库结构

```
plugin/            插件源码（唯一事实源；发布 zip 时内容直接落 zip 根）
  plugin.ts        manifest + 装配入口（生命周期、扩展点全在这接线）
  schema.ts        drizzle 表定义（plugin_<名>_ 前缀表名 + 自动 DDL）
  api.ts           HTTP 端点（public / admin 两档鉴权）
  i18n.ts          文案（一次注册，前后台共用）
  components/      插槽组件（前台/管理端各一示例）
  routes/          后台路由页示例
  e2e/             Playwright 用例（host-helpers.ts 为宿主 e2e 基建的
                   vendored 最小移植）
  *.test.ts        vitest 测试（manifest.test.ts 是手搓 ctx 的冒烟样板）
scripts/
  rename.mjs       一键改名
  ensure-host.mjs  宿主自动装配（clone + install + 生成层补齐 + 挂载插件）
  sync-watch.mjs   plugin/ 热同步（pnpm dev 的 watch 侧）
  package.mjs      打发布 zip + SHA-256
  prepare-npm-pkg.mjs  生成摊平的 npm 发布物 dist/npm/（含包名护栏）
  reset-e2e-db.mjs 擦净 e2e 数据库
e2e/warmup.global.ts  dev 冷编译预热（best-effort）
.sveltecms/        框架 checkout（自动创建，gitignore，勿手改）
.github/workflows/ CI（test/check/e2e）+ Release（tag → zip → 市场自动上架）
```

## 常用命令

```bash
pnpm dev          # 起完整站点(5179) + 插件热同步
pnpm test         # vitest（装配检查 + 单测/渲染测试）
pnpm check        # svelte-check 类型门禁
pnpm e2e          # Playwright 全链路（起宿主 dev 跑冒烟）
pnpm package      # dist/<name>-<version>.zip + SHA-256
pnpm npm-pkg      # dist/npm/ 摊平发布物（npm publish 的前置；见「发布与上架」）
```

宿主版本控制：默认 clone `master`；`SVELTECMS_REF=<分支/标签>` 锁版本；
`SVELTECMS_HOST_PULL=1 pnpm ensure` 刷新到上游最新（默认锁 clone 时 commit，
行为可复现）；`SVELTECMS_REPO=<git URL>` 换框架源。

## 语法提示（IDE 零配置可用）

打开本仓的 VS Code / Cursor 应**没有任何红线**——类型链路是刻意设计的：

| 机制 | 文件 | 作用 |
| --- | --- | --- |
| 宿主类型层 | `tsconfig.json`（extends `.sveltecms/.svelte-kit/tsconfig.json` + include 宿主 `app.d.ts`） | `$lib/cms/*` 的 `PluginContext`/`CollectionConfig` 全类型可跳读，`event.locals.user` 增强可用 |
| Svelte 语言服务 | `svelte.config.js`（runes: true + vitePreprocess） | `.svelte` 里 `$state/$derived/$props` 正确解析，按 Svelte 5 写 |
| TS 版本对齐 | `.vscode/settings.json`（tsdk 指向本仓 typescript） | 编辑器与 `pnpm check` 同版本，提示=门禁 |
| 行类型派生 | `plugin/types.ts`（interface + InferSelectModel 一致性断言） | `ctx.db.find<Item>(...)` 字段直接补全；schema 漂移编译即错 |
| 契约名补全 | 宿主类型层（`SlotName`/`CmsEvents`/`MenuIconName`/`FilterHookName`，开放联合不拒自定义） | `ctx.slot.register('…')`、`ctx.event.on('…')`、`ctx.menu` 的 icon、`ctx.filters` 挂点都有字面量补全（宿主 pull 后生效） |

提示不新鲜时：VS Code `Ctrl+Shift+P → Restart TS Server`（ensure 装配刷新过
`.svelte-kit/types` 之后执行一次）。`pnpm check` 始终是唯一裁判——它过了，
你看到的类型就是对的。

## 扩展点清单（register 里的 ctx.*）

| 域 | 一行说明 | 模板示例 |
| --- | --- | --- |
| `ctx.collection` | 注册集合 → 后台「内容」菜单 + 通用 CRUD/RBAC/搜索 | ✅ |
| `ctx.schema` | drizzle 表登记，引擎自动建表（`plugin_<名>_` 前缀强制） | ✅ |
| `ctx.api` | `/api/v1/plugin/<名>/*`；`public: true` 免登录，否则管理员会话 | ✅ |
| `ctx.route` | 后台页挂 `/admin/plugin-pages/*` | ✅ |
| `ctx.menu` | 侧栏菜单项（集合菜单自动注入，这里注册自定义页入口） | ✅ |
| `ctx.slot` | 组件插槽：前台 `frontend:content-after`、管理端 `collection-form-fields-after`、`dashboard-widget` 等，全清单见 `.sveltecms/src/lib/cms/registries/slot.ts` | ✅ |
| `ctx.i18n` | 文案注册；服务端 `ctx.i18n.t()`，前台 `loadPluginMessages('<名>')` | ✅ |
| `ctx.filters` | 内容管线变换：`content:beforeWrite`（throw 即否决）、`content:render` | ✅ |
| `ctx.event` | 订阅系统事件（`collection:*` / `media:*` / `plugin:*`）+ 广播自定义 | ✅ |
| `ctx.actions` | 后台动作按钮：参数表单/确认/结果 toast 全声明式 | ✅ |
| `ctx.config` | 读站长设置（manifest.config 声明） | ✅ |
| `ctx.request` | 请求管线中间件（鉴权后治理，throw 即拒绝） | 注释示例 |
| `ctx.editor` | Tiptap 富文本扩展注入 | 注释示例 |

其余运行时能力：`ctx.db`（沙箱：本插件表自由读写，系统表须 manifest
`permissions` 声明）、`ctx.content`（内容引擎门面）、`ctx.notification`、
`ctx.mail`、`ctx.cache`、`ctx.search`、`ctx.rbac`、`ctx.logger`、`ctx.tasks`、
`ctx.siteUrl`。

## 硬约束（违反 = 注册失败，fail-fast 是设计）

- **命名**：物理表 `plugin_<插件名>_*`（前缀引擎校验；rename 脚本已按此派生）；
  集合 slug 匹配 `/^[a-zA-Z][a-zA-Z0-9_]*$/`（无连字符——kebab 名转 snake 作
  slug 与 schema key）且必须与 schema 导出 key 一致（PLN-2）；slug 不得与
  系统表同名（`pages`/`user`/…）。manifest.test 的命名断言用例锁死这三条，
  改名/加表后跑测试即自检
- **配置值三类型 stringly-stored**：管理端一律字符串落库，boolean 判断要
  兼容 `true / 'true'`（api.ts 示范）
- **登录态**：better-auth 端点不走 HTTP（全 410）——组件要登录态，随自家
  端点响应下发 `event.locals.user` 派生的 viewer（api.ts 示范），别探测
  `/api/auth/*`
- **权限申报**：碰系统表必须 `manifest.permissions` 登记，市场/部署者按
  清单审计——能少要就少要

## 发布与上架

两条交付路，产物同源（都按 `manifest.name` 认身份）：

```bash
pnpm package      # dist/<name>-<version>.zip + SHA-256
pnpm npm-pkg      # dist/npm/（摊平发布物）→ 打印 npm publish 命令
git tag v0.1.0 && git push --tags   # CI：挂 Release 资产；配了 NPM_TOKEN 才发 npm
```

### 路 1：zip / 社区市场（主路）

向 [sveltecms-marketplace](https://github.com/hongweifei/sveltecms-marketplace)
提 PR 加一条 repo 项（发 Release 即自动上架/更新）：

```json
{ "type": "repo", "url": "github.com/<you>/sveltecms-plugin-hello-world" }
```

### 路 2：npm 包

`pnpm add sveltecms-plugin-<name>` 即可，无需 zip、无需落 `data/plugins/`。
生产是**运行时**扫描 `node_modules` 发现它的，所以装完**重启进程**就生效、
不必重新构建（这点和主题相反——主题的组件是编译期收录）。

`dist/npm/` 是生成的：`scripts/prepare-npm-pkg.mjs` 把 `plugin/` 的内容**摊平到
包根**——宿主的发现 glob 只认 `node_modules/sveltecms-plugin-<name>/plugin.ts`
一层，不摊平发出去的包宿主根本看不见。模板自身 `package.json` 保持
`private: true`（防误发模板），发布物那份不带 `private`，作者不用改这个字段。
护栏：包名仍是 `sveltecms-plugin-template` 或不以 `sveltecms-plugin-` 开头时，
脚本直接拒绝生成。

版本号唯一事实源 = `plugin/plugin.ts` 的 `manifest.version`（package.json
同步；`ctx.db` 数据兼容由你负责，框架提供 `migrate(from, ctx)` 钩子）。
宿主版本兼容用 `manifest.engines.cms` 声明，见「宿主版本兼容声明」。

> npm 包的 `.svelte` 组件同样可用（宿主对 `node_modules/sveltecms-plugin-*`
> 有编译期 glob），但**装包后需重新构建**才进 bundle——这条仍是 PLN-12 的约束。

## 疑难

- **改了插件服务端代码不生效** → 后台「插件管理 → 重载」或重启 dev（SSR
  import 缓存，见「三步上手」）
- **`pnpm test` 报 `$lib` 解析失败** → `pnpm ensure` 重装配（宿主缺生成层）
- **e2e 首跑超时的用例轮换** → dev 冷编译竞态；warmup 已吸收大半，CI 有
  retries；本地重跑即绿
- **想参考完整实战** → 官方评论插件仓库 `sveltecms-plugin-comments`（本
  模板的全部机制都在那里被真实需求打磨过一遍）
