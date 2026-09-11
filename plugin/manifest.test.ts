import { describe, it, expect, vi } from 'vitest';
import plugin from './plugin';

/**
 * 冒烟测试：装配入口能跑通、各扩展点按预期注册。手搓记录型 ctx——不依赖
 * 宿主 test-helpers，模板自带自解释的最小替身；改名后按需增减断言。
 */
function mockCtx() {
	const rec = {
		collection: [] as any[],
		route: [] as any[],
		api: [] as any[],
		slot: [] as any[],
		menu: [] as any[],
		schema: [] as string[],
		i18n: [] as string[],
		actions: [] as any[],
		filters: [] as string[],
		events: [] as string[]
	};
	const noop = vi.fn();
	const ctx: any = {
		collection: { register: (c: any) => rec.collection.push(c) },
		field: { register: noop },
		route: { register: (r: any) => rec.route.push(r) },
		api: { register: (e: any) => rec.api.push(e) },
		slot: { register: (name: string, comp: string) => rec.slot.push({ name, comp }) },
		menu: { register: (items: any[]) => rec.menu.push(...items) },
		schema: { register: (key: string) => rec.schema.push(key) },
		i18n: { register: (name: string) => rec.i18n.push(name), t: (k: string) => k },
		actions: { register: (a: any) => rec.actions.push(a) },
		filters: { register: (hook: string) => rec.filters.push(hook) },
		event: { on: (ev: string) => rec.events.push(ev), emit: noop },
		request: { register: noop },
		editor: { register: noop },
		config: { get: (_k: string, d?: unknown) => d, getAll: () => ({}), set: noop },
		logger: { info: noop, warn: noop, error: noop, debug: noop },
		db: {
			find: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
			create: vi.fn(async (d: any) => ({ id: 'x', ...d })),
			update: vi.fn(async (id: string) => ({ id })),
			delete: vi.fn(async () => {}),
			count: vi.fn(async () => 0)
		},
		notification: { on: noop, notifyAdmins: vi.fn(async () => {}), notifyUser: vi.fn(async () => true) },
		cache: { get: async () => undefined, set: noop, delete: noop },
		search: { index: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
		mail: { send: vi.fn(async () => true), sendTemplate: vi.fn(async () => true) },
		content: { query: vi.fn(async () => ({ data: [] })) },
		siteUrl: 'http://localhost',
		pluginName: 'my-plugin'
	};
	return { ctx, rec };
}

describe('my-plugin manifest', () => {
	it('manifest 形状正确', () => {
		expect(plugin.manifest.name).toBe('my-plugin');
		expect(plugin.manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it('register 装配全部扩展点', async () => {
		const { ctx, rec } = mockCtx();
		await plugin.register!(ctx);

		expect(rec.schema).toContain('my_plugin_items');
		expect(rec.collection.map((c) => c.slug)).toContain('my_plugin_items');
		expect(rec.route.map((r) => r.path)).toContain('/my-plugin');
		expect(rec.slot.map((s) => s.name)).toEqual(
			expect.arrayContaining(['frontend:content-after', 'collection-form-fields-after'])
		);
		expect(rec.menu.map((m) => m.key)).toContain('my-plugin');
		expect(rec.api.map((a) => `${a.method} ${a.path}`)).toEqual(
			expect.arrayContaining(['GET /items', 'GET /whoami'])
		);
		expect(rec.i18n).toContain('my-plugin');
		expect(rec.actions.map((a) => a.key)).toContain('purge');
		expect(rec.filters).toContain('content:beforeWrite');
		expect(rec.events).toContain('collection:created');
	});

	it('集合 slug 与 schema key 一致（PLN-2 约束）', async () => {
		const { ctx, rec } = mockCtx();
		await plugin.register!(ctx);
		for (const c of rec.collection) {
			expect(rec.schema).toContain(c.slug);
		}
	});

	it('物理表带插件前缀、slug 合法（SEC-5/PLN-2 命名约束）', async () => {
		const { getTableName } = await import('drizzle-orm');
		const schema = (await import('./schema')).default;
		for (const [key, table] of Object.entries(schema)) {
			// 物理表名必须 plugin_<插件名>_ 前缀（引擎 DDL/沙箱校验）
			const physical = getTableName(table as Parameters<typeof getTableName>[0]);
			expect(physical.startsWith('plugin_my-plugin_')).toBe(true);
			// schema key（= 集合 slug）受 SAFE_SLUG_RE 约束（字母开头，无连字符）
			expect(key).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
		}
	});
});
