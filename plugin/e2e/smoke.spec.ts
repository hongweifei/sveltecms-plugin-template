import { test, expect } from '@playwright/test';
// helpers 自持（vendored 自宿主 e2e/helpers.ts，见 host-helpers.ts 头注）
import { getAdminContext } from './host-helpers';

/**
 * 插件 e2e 冒烟：启用插件 → 后台路由页可达 → 前台插槽渲染。
 * 改名后按你的插件调整断言（这里以模板默认形态为例）。
 */

/** 首访路由冷编译（vite dev 按需编译）下断言锚点的统一宽限 */
const READY_TIMEOUT = 90_000;

test.describe('my-plugin 冒烟', () => {
	test('启用插件', async ({ browser }) => {
		const ctx = await getAdminContext(browser);
		const page = await ctx.newPage();

		await page.goto('/admin/plugins/my-plugin');

		// dev 冷启动 hydration 竞态：SSR 一到达「已禁用」按钮即可见但事件未
		// attach，单次 click 可能落空——轮询重放直到状态翻转（已启用出现）。
		const on = page.locator('button', { hasText: '已启用' }).first();
		const off = page.locator('button', { hasText: '已禁用' }).first();
		await expect(async () => {
			if ((await on.count()) > 0) return;
			if ((await off.count()) > 0) await off.click();
			throw new Error('plugin toggle not applied yet');
		}).toPass({ timeout: READY_TIMEOUT });
		await expect(on).toBeVisible({ timeout: 20_000 });

		await ctx.close();
	});

	test('后台插件路由页可达', async ({ browser }) => {
		const ctx = await getAdminContext(browser);
		const page = await ctx.newPage();
		await page.goto('/admin/plugin-pages/my-plugin');
		await expect(page.locator('body')).toContainText('模板插件', {
			timeout: READY_TIMEOUT
		});
		await ctx.close();
	});

	test('侧栏出现集合菜单（启用插件 → 热注入）', async ({ browser }) => {
		const ctx = await getAdminContext(browser);
		const page = await ctx.newPage();
		await page.goto('/admin/dashboard');
		// 锚定 <aside> 侧栏：仪表盘的内容类型卡片同 href，裸 locator 会撞
		// strict mode（解析出 2 个元素）
		await expect(
			page.locator('aside a[href="/admin/content/my_plugin_items"]')
		).toBeVisible({
			timeout: READY_TIMEOUT
		});
		await ctx.close();
	});
});
