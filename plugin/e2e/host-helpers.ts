/**
 * E2E 基建（vendored 自宿主 e2e/helpers.ts @ b5aa4a7）。
 *
 * 自持而非经 .host 引用：宿主 e2e 是未承诺的内部件（引用会引入第二份
 * @playwright/test 实例直接炸 runner），外部插件开发者同样需要一份可
 * 复制的样板——本文件即「宿主 e2e 基建的最小移植」。
 * 约定：playwright 进程 cwd = 本仓根，helpers 的相对路径 e2e-data/* 与
 * playwright.config 的 DATABASE_URL 绝对路径指向同一目录。
 */
import { expect, type Browser, type Page } from '@playwright/test';
import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';

/**
 * E2E 测试基建（核心流规范共用）。
 *
 * 账号引导：登录页「注册」表单目前不渲染注册验证码输入框（服务端 signUp 动作
 * 要求 signUpCode + signup_verify cookie），故注册码交换走真实 HTTP 表单动作
 * （fetch 同源自动带 cookie），验证码本身从邮件发送日志（email_logs 表，console
 * provider 落库）读取——仍是完整服务端路径（sendSignUpCode → 邮件 → signUp）。
 * 登录/内容/发布等其余环节全部走 UI。
 */

export const ADMIN_EMAIL = 'e2e-admin@example.com';
export const ADMIN_PASSWORD = 'E2e-Password-2026';
export const ADMIN_USERNAME = 'e2eadmin';

/** 从 E2E 独立数据库读取最近一封发给指定邮箱的邮件文本（含注册验证码） */
export async function fetchLatestMailText(to: string): Promise<string | null> {
	const client = createClient({ url: 'file:e2e-data/e2e.db' });
	try {
		const r = await client.execute({
			sql: 'SELECT text FROM email_logs WHERE "to" = ? ORDER BY created_at DESC LIMIT 1',
			args: [to]
		});
		const row = r.rows[0] as { text?: string | null } | undefined;
		return row?.text ?? null;
	} catch {
		// email_logs 表尚未建好等瞬时情况，返回 null 由调用方重试
		return null;
	} finally {
		client.close();
	}
}

/** 轮询等待邮件落库并提取 6 位验证码 */
export async function waitForSignUpCode(page: Page, email: string): Promise<string> {
	let last: string | null = null;
	for (let i = 0; i < 20; i++) {
		last = await fetchLatestMailText(email);
		const m = last?.match(/\d{6}/);
		if (m) return m[0];
		await page.waitForTimeout(500);
	}
	throw new Error(`Sign-up code not found for ${email}; last mail text: ${last}`);
}

/**
 * 通过真实 HTTP 表单动作完成注册（首用户即 admin）：
 * 1. POST ?/sendSignUpCode（浏览器上下文自动携带 signup_verify cookie）
 * 2. 从 email_logs 读取验证码
 * 3. POST ?/signUp —— 成功后重定向到 /admin/dashboard 并建立会话
 */
export async function signUpViaHttp(page: Page): Promise<void> {
	await page.goto('/login');
	const sent = await page.evaluate(async (email) => {
		const fd = new FormData();
		fd.set('email', email);
		const r = await fetch('/login?/sendSignUpCode', { method: 'POST', body: fd });
		return r.status;
	}, ADMIN_EMAIL);
	// 邮箱已注册（跨 spec 共享账号）→ 直接 UI 登录
	if (sent !== 200) {
		await loginViaUi(page);
		return;
	}
	const code = await waitForSignUpCode(page, ADMIN_EMAIL);
	const resp = await page.evaluate(
		async ({ email, code, username, password }) => {
			const fd = new FormData();
			fd.set('username', username);
			fd.set('name', username);
			fd.set('email', email);
			fd.set('password', password);
			fd.set('signUpCode', code);
			return fetch('/login?/signUp', { method: 'POST', body: fd, redirect: 'manual' }).then(
				async (r) => {
					// SvelteKit 表单动作以 200 + {"type":"redirect","status":303,...} JSON
					// 返回重定向（浏览器导航才发 HTTP 303），两种情况都算成功
					const body = await r.json().catch(() => null);
					const redirected =
						r.status === 303 || (body && body.type === 'redirect' && body.status === 303);
					return { status: r.status, location: body?.location ?? null, redirected };
				}
			);
		},
		{ email: ADMIN_EMAIL, code, username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
	);
	// 注册失败（如限流/竞态）时回退 UI 登录；成功则携带会话进入后台
	if (!resp.redirected) {
		await loginViaUi(page);
		return;
	}
	expect(resp.location).toContain('/admin/dashboard');
	await page.goto('/admin/dashboard');
	await page.waitForURL(/\/admin\/dashboard/);
}

/** 已注册场景（跨 spec 共享管理员账号）：直接走 UI 登录 */
export async function loginViaUi(page: Page): Promise<void> {
	await page.goto('/login');
	await page.locator('input[name="login"]').fill(ADMIN_EMAIL);
	await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL(/\/admin\/dashboard/);
}

/** 管理员会话状态文件：登录限流 5 次/分，跨 spec 共享会话避免重复登录 */
const ADMIN_STATE = 'e2e-data/admin-state.json';

export async function saveAdminState(page: Page): Promise<void> {
	await page.context().storageState({ path: ADMIN_STATE });
}

/**
 * 创建已登录管理员的浏览器上下文：状态文件存在则直接复用会话；
 * 否则现场注册（首用户即 admin）并保存会话。适用于 content/publish 规范。
 * contextOptions：globalSetup 里自 launch 的 browser 不继承 config.use
 * （无 baseURL），调用方需显式传入。
 */
export async function getAdminContext(
	browser: Browser,
	contextOptions?: Parameters<Browser['newContext']>[0]
) {
	if (existsSync(ADMIN_STATE)) {
		return browser.newContext({ ...contextOptions, storageState: ADMIN_STATE });
	}
	const ctx = await browser.newContext(contextOptions);
	const page = await ctx.newPage();
	await signUpViaHttp(page);
	await ctx.storageState({ path: ADMIN_STATE });
	return ctx;
}

/** 创建一篇页面（发布意图 _intent=publish），返回其 slug */
export async function createPageViaUi(
	page: Page,
	opts: { title: string; slug: string; content: string; publish?: boolean }
): Promise<void> {
	await page.goto('/admin/content/pages/create');
	// banner 里还有 logout form——锚定标题输入框而非裸 form（避免 strict 违规）
	await expect(page.locator('input[name="title"]')).toBeVisible();
	await page.locator('input[name="title"]').fill(opts.title);
	await page.locator('input[name="slug"]').fill(opts.slug);
	const content = page.locator('input[name="content"]');
	if (await content.count()) {
		// richtext 由 Tiptap 管理，隐藏 input 在提交时序列化 DOM value——直接赋值即可
		await content.evaluate((el, v) => ((el as HTMLInputElement).value = v), opts.content);
	}
	// _intent=draft / _intent=publish 两个提交按钮
	await page
		.locator(`button[name="_intent"][value="${opts.publish ? 'publish' : 'draft'}"]`)
		.click();
	// 成功 → 303 跳转列表页 `/admin/content/pages?created=1`（create action 的 redirect 目标）；
	// 正则锚定查询参数，避免与当前 create 页 URL 即刻匹配成空等待（ISS-26）。
	// 失败（表单校验等）→ 捕获页面上的错误文案便于诊断
	await Promise.race([
		page.waitForURL(/\/admin\/content\/pages\?created=1/, { timeout: 15_000 }),
		page
			.locator('text=/错误|失败|Error|Failed|Invalid|必填|required/i')
			.first()
			.waitFor({ state: 'visible', timeout: 15_000 })
			.then(() => {
				throw new Error(`create page action failed for "${opts.slug}": ${page.url()}`);
			})
	]);
}
