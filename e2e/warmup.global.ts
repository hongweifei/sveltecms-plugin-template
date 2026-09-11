import { chromium, type FullConfig } from '@playwright/test';
import { getAdminContext } from '../plugin/e2e/host-helpers';

/**
 * 预热（best-effort）：dev server 端口就绪 ≠ 路由编译完成，首个用例的 goto
 * 常吃 30-90s 冷编译、导航半途中止而误判「按钮没出现」。测试跑前用管理员
 * 会话串行访问关键路由触发编译；任何失败都不阻断测试（用例自带宽限）。
 *
 * 按你的插件调整路由清单。
 */
export default async function warmup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5179';
	const browser = await chromium.launch();
	try {
		// globalSetup 自 launch 的 browser 不继承 config.use——baseURL 与超时
		// 显式透传
		const ctx = await getAdminContext(browser, {
			baseURL,
			navigationTimeout: 180_000,
			actionTimeout: 180_000
		});
		const page = await ctx.newPage();
		for (const path of ['/admin/plugins/my-plugin', '/admin/dashboard', '/']) {
			await page.goto(baseURL + path, { timeout: 180_000, waitUntil: 'load' }).catch(() => {});
		}
		await ctx.close();
	} catch (e) {
		console.warn(`[warmup] 预热未完成（不阻断，用例自带宽限）：${String(e)}`);
	} finally {
		await browser.close();
	}
}
