/**
 * 插件模板（脚手架）——三步变成你的插件：
 *   1. node scripts/rename.mjs <插件名>   # 标识符全量改名（kebab-case）；
 *      中文文案（"模板插件"等）与不需要的示例自行删改；
 *   2. pnpm install（首次还会自动 clone 框架装配 .sveltecms/，慢几分钟）；
 *   3. pnpm dev → http://localhost:5179 —— 完整站点已挂上你的插件。
 *
 * 生命周期（引擎调用顺序）：register → onInstall（仅首次）→ onActivate →
 * （运行期）→ onDeactivate →（卸载）onUninstall。register 里只做「注册声明」，
 * 重活留给 onInstall/onActivate；停用/卸载时框架会按注册逆序回滚所有 handle
 * （集合/路由/端点/插槽/菜单/事件/i18n 全部自动清理，不用手写拆卸逻辑）。
 *
 * API 面（ctx.* 13 域）速览见 README「扩展点清单」；完整类型：
 * .sveltecms/src/lib/cms/types/plugin.ts（dev 装配后可直接跳读）。
 */
import type { Plugin } from '$lib/cms/types/plugin';
import { registerSchema } from '$lib/cms/utils';

const plugin: Plugin = {
	manifest: {
		// name 即插件目录名与 zip 标识，小写连字符
		name: 'my-plugin',
		version: '0.1.0',
		description: {
			zh: 'SvelteCMS 插件模板——改名即用的最小可运行脚手架',
			en: 'SvelteCMS plugin template — rename and go'
		},
		// 宿主兼容声明（semver；0.x 的 minor 变更即破坏）——发布时按实际下限收紧
		engines: { cms: '>=0.1.0' },
		/**
		 * [示例·配置] 站长可改的站点级设置：管理端「插件 → 配置」表单渲染，
		 * 运行时 ctx.config.get(key, 默认值) 读取。label 用 I18nText，
		 * 英文后台不再显示中文。注意：管理端落库值一律字符串形态——boolean
		 * 判断要兼容 true/'true' 两种（api.ts 有示范）。
		 */
		config: [
			{
				key: 'enabled',
				type: 'boolean',
				label: { zh: '启用示例功能', en: 'Enable demo feature' },
				default: true
			},
			{
				key: 'maxItems',
				type: 'number',
				label: { zh: '条目上限（0 = 不限）', en: 'Max items (0 = unlimited)' },
				default: 100
			}
		]
		/**
		 * [示例·权限] 声明式系统表访问（SEC-5，deny-by-default）：
		 * 插件自己的表（plugin_my-plugin_*）无需声明即可读写；要碰系统表
		 * （user/pages/roles……）必须在此登记，未知名/越权名注册时直接拒绝。
		 * systemTables=读写，readSystemTables=只读。
		 */
		// permissions: { readSystemTables: ['pages'] },
	},

	async register(ctx) {
		// ── 数据层 ────────────────────────────────────────────────
		// 1) 物理表：schema.ts 导出表集合，registerSchema 登记（引擎自动 DDL，
		//    表名必须 plugin_<插件名>_ 前缀——引擎注册期校验）。
		// 2) 集合（可选）：有集合才有后台「内容」菜单与通用 CRUD UI + RBAC。
		//    只需要 KV/辅助表、不要后台管理界面的插件，可以只注册 schema。
		const schema = (await import('./schema')).default;
		registerSchema(ctx.schema, schema);

		// [示例·集合] slug 规则：SAFE_SLUG_RE（字母开头，仅字母/数字/下划线，
		// 不含连字符）+ 避开系统表名；schema 默认导出必须含同名 key（PLN-2）
		ctx.collection.register({
			kind: 'collection',
			slug: 'my_plugin_items',
			label: '模板条目',
			labelI18n: { en: 'Template Items' },
			icon: '🧩',
			api: true,
			fields: [
				{
					name: 'title',
					type: 'text',
					required: true,
					label: '标题',
					labelI18n: { en: 'Title' }
				},
				{
					name: 'note',
					type: 'textarea',
					label: '备注',
					labelI18n: { en: 'Note' }
				}
			],
			list: {
				columns: ['title', 'createdAt'],
				searchable: ['title'],
				sortable: ['createdAt'],
				defaultSort: '-createdAt'
			}
		});

		// ── HTTP API ─────────────────────────────────────────────
		// 挂载点 /api/v1/plugin/my-plugin/*。public: true = 免登录可达
		//（前台组件调用走这条）；不标 public 自动要求管理员 API 会话。
		// event.locals.user 服务端会话权威判定（better-auth 端点不走 HTTP，
		// 插件的登录态一律经自家端点随响应下发，如本例 viewer）。
		const { registerPublicApi } = await import('./api');
		registerPublicApi(ctx);

		// ── UI 接入 ──────────────────────────────────────────────
		// [示例·后台路由 + 菜单] 页面挂 /admin/plugin-pages/<path>，配菜单入口。
		//（启用集合后侧栏「内容」菜单自动注入，无需手注册集合菜单）
		ctx.route.register({
			path: '/my-plugin',
			type: 'admin',
			component: 'routes/admin-page.svelte'
		});
		ctx.menu.register([
			{
				key: 'my-plugin',
				label: '模板插件',
				labelI18n: { en: 'My Plugin' },
				icon: 'Puzzle',
				href: '/admin/plugin-pages/my-plugin',
				locations: ['admin_sidebar'],
				group: '开发',
				order: 120
			}
		]);

		// [示例·前台插槽] frontend:content-after = 默认主题正文之后（评论区同款
		// 挂载点）。组件内 fetch 自家 public 端点取数；SSR 缓存页勿渲染实时态。
		ctx.slot.register('frontend:content-after', 'components/slot-frontend.svelte');

		// [示例·管理端插槽] collection-form-fields-after = 内容编辑表单字段后；
		// 另有 dashboard-widget / sidebar-bottom / header-actions 等，完整清单：
		// .sveltecms/src/lib/cms/registries/slot.ts
		ctx.slot.register('collection-form-fields-after', 'components/slot-admin.svelte');

		// ── 行为扩展 ─────────────────────────────────────────────
		// [示例·i18n] 一次注册、前后台共用：服务端 ctx.i18n.t(key)；前台组件经
		// loadPluginMessages('<插件名>') 从 /api/v1/i18n/<插件名> 拉同一份。
		const { messages } = await import('./i18n');
		ctx.i18n.register('my-plugin', messages);

		// [示例·后台动作按钮] 参数表单/确认/结果 toast 由框架渲染，run 里做重活。
		ctx.actions.register({
			key: 'purge',
			label: { zh: '清理过期条目', en: 'Purge expired items' },
			description: { zh: '演示声明式动作按钮', en: 'Declarative action demo' },
			confirm: { zh: '确认清理？', en: 'Confirm purge?' },
			input: [{ key: 'days', label: { zh: '保留天数', en: 'Keep days' }, type: 'number' }],
			async run(input) {
				const days = Number(input.days) || 30;
				// const n = await ctx.db.deleteWhere(...); 真实清理见 db 沙箱
				return { ok: true, message: `已按 ${days} 天策略处理（示例未执行）` };
			}
		});

		// [示例·内容管线 filter] content:beforeWrite 落库前变换/否决
		//（throw 即拒绝写入）；挂点还有 content:render 等。
		ctx.filters.register(
			'content:beforeWrite',
			(value, fctx) => {
				if (fctx.collection !== 'my_plugin_items') return value;
				const data = value as Record<string, unknown>;
				return typeof data.title === 'string' ? { ...data, title: data.title.trim() } : value;
			},
			{ priority: 150 }
		);

		// [示例·事件] 订阅系统事件（collection:*/media:*/plugin:*，前缀白名单）；
		// ctx.event.emit('my-plugin:done', …) 可广播自定义事件给其他插件。
		ctx.event.on('collection:created', (payload: unknown) => {
			const p = payload as { slug?: string };
			if (p?.slug === 'my_plugin_items') {
				ctx.logger.info('template item created');
			}
		});

		// [示例·请求中间件] 治理请求（鉴权收口后执行），throw 即拒绝；
		// 作用域按 collection / path 选择，priority 控制顺序。
		// ctx.request.register(
		// 	({ collection }) => { if (…) throw new Error('rejected'); },
		// 	{ collection: 'my_plugin_items', priority: 200 }
		// );

		// [示例·编辑器扩展] Tiptap mark/extension 注入富文本编辑器（动态 import）
		// ctx.editor.register({
		// 	name: 'demo-mark',
		// 	extension: async () => (await import('./editor-extensions')).DemoMark
		// });
	},

	async onInstall(ctx) {
		// 首次安装：种默认数据（此时 ctx.db 的表已建好）
		ctx.logger.info('my-plugin installed');
	},

	async onActivate() {
		// 每次启用（含冷启动激活）：定时器/缓存预热等（签名无 ctx——要状态请在
		// register 闭包里备好）。
		// 注意：停用/卸载的清理交给框架 handle 逆序回滚，一般不用写 onDeactivate。
	},

	async onUninstall(ctx) {
		// 卸载：清自己的数据（ctx.db 只能碰本插件声明/前缀表）。
		// 不写则默认留表留数据（升级重装可复用）。
	}
};

export default plugin;
