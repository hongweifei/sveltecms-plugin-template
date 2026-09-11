import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
// 宿主框架在仓内 .sveltecms/（真目录，ensure-host 自动装配）。
// e2e helpers（plugin/e2e/host-helpers.ts，vendored 自宿主）以相对路径
// file:e2e-data/e2e.db 读写数据库，其解析基准是 playwright 进程 cwd =
// 本仓根；server 的 cwd 在 .sveltecms，故 DATABASE_URL 给绝对路径指回
// 本仓 e2e-data，两侧同文件。
const HOST = path.join(ROOT, '.sveltecms');
const E2E_DB = path.join(ROOT, 'e2e-data/e2e.db').replaceAll('\\', '/');

export default defineConfig({
	testDir: './plugin/e2e',
	globalSetup: './e2e/warmup.global.ts',
	timeout: 120_000,
	expect: { timeout: 10_000 },
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5179',
		actionTimeout: 90_000,
		navigationTimeout: 90_000,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// cwd 显式钉在本仓根：pnpm 可能从任意位置调起，而 helpers 的相对
		// DB 路径（e2e-data/e2e.db）与 reset 脚本都以本仓根为基准
		cwd: ROOT,
		// 插件源码已由 pnpm e2e 前置的 ensure-host 同步进 .sveltecms；
		// reset-e2e-db 擦净本仓 e2e-data 后起宿主 dev
		command: `node scripts/reset-e2e-db.mjs && pnpm --dir "${HOST}" exec vite dev --port 5179 --strictPort`,
		port: 5179,
		timeout: 180_000,
		reuseExistingServer: false,
		env: {
			DATABASE_URL: `file:${E2E_DB}`,
			ORIGIN: 'http://localhost:5179',
			BETTER_AUTH_SECRET: 'e2e-test-secret-0123456789abcdef0123456789abcdef',
			LOGIN_RATE_MAX: '100'
		}
	}
});
