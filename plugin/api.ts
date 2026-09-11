import type { PluginContext, PluginApiEndpoint } from '$lib/cms/types/plugin';
import type { Item } from './types';

/**
 * 插件 HTTP API：挂载在 /api/v1/plugin/<插件名>/ 下。
 *
 * public: true → 免登录可达（前台组件调用走这条）；不标则自动要求管理员 API
 * 会话（框架侧 requireAdminAccessApi），插件内不用再写鉴权。
 * 会话身份一律读 event.locals.user（服务端 better-auth 判定，客户端不可伪造）
 * ——本应用 better-auth 端点不走 HTTP，前端要登录态请随自家端点响应下发。
 */

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export function registerPublicApi(ctx: PluginContext): void {
	const endpoints: PluginApiEndpoint[] = [
		{
			method: 'GET',
			path: '/items',
			public: true,
			handler: async (event) => {
				// 读 URL 查询参数
				const url = new URL(event.request.url);
				const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

				// ctx.db 沙箱：本插件表自由读写；系统表须 manifest 声明。
				// 泛型参数 = 行类型（types.ts 由 schema 派生并做一致性断言），
				// 消费侧字段直接类型化，无需手写转型
				const result = await ctx.db.find<Item>('my_plugin_items', {
					sort: '-createdAt',
					limit
				});

				// ctx.config 读站长设置（manifest.config 声明过的 key）。
				// 注意三类型 stringly-stored：管理端 boolean 落库是 'true'/'false'
				// 字符串，两种形态都要认——评论插件 config.ts 的 readBool 同款
				const rawEnabled = ctx.config.get('enabled', true);
				const enabled = rawEnabled === true || rawEnabled === 'true';

				return json({
					enabled,
					// result.data 已是 Item[]（泛型注入），字段直接补全、无需转型
					items: result.data.map((row) => ({ id: row.id, title: row.title })),
					total: result.meta?.total ?? result.data.length
				});
			}
		},
		{
			// 演示：把服务端会话身份随响应下发给前端组件（前端据此显示登录态 UI）
			method: 'GET',
			path: '/whoami',
			public: true,
			handler: async (event) => {
				const user = event.locals.user;
				return json({ viewer: user ? { name: user.name ?? '' } : null });
			}
		}
	];

	for (const e of endpoints) ctx.api.register(e);
}
