/**
 * 宿主框架自动装配：.sveltecms/ = 框架 checkout，本仓自持（gitignore），
 * 插件开发者不需要预先在别处 clone 框架。插件名从 plugin/plugin.ts 的
 * manifest.name 动态读取——模板改名后无需改脚本。
 *
 * 首次运行自动完成（慢一次，之后增量）：
 *   1. git clone --depth 1 框架仓库到 .sveltecms/
 *   2. 宿主 pnpm install
 *   3. svelte-kit sync + drizzle-kit generate + paraglide compile（fresh clone 补齐）
 *   4. 把 plugin/ 同步进 .sveltecms/data/plugins/<name>/（编译期 glob 收录）
 *
 * 用法：
 *   node scripts/ensure-host.mjs            # 装配/刷新
 *   node scripts/ensure-host.mjs --sync     # 只同步插件源码
 *   node scripts/ensure-host.mjs --check    # 只校验已装配，未装配退出码 1
 *
 * 覆盖：SVELTECMS_REPO（框架 git URL）、SVELTECMS_REF（分支/标签，默认 master）
 */
import { existsSync, mkdirSync, cpSync, lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = path.join(ROOT, '.sveltecms');
const PLUGIN_SRC = path.join(ROOT, 'plugin');
const REPO = process.env.SVELTECMS_REPO || 'https://gitee.com/hongweifei/sveltecms-starter.git';
const REF = process.env.SVELTECMS_REF || 'master';

/** 插件名 = manifest.name（模板改名脚本写入后自动跟随） */
function pluginName() {
	const src = readFileSync(path.join(PLUGIN_SRC, 'plugin.ts'), 'utf8');
	const m = /name:\s*'([^']+)'/.exec(src);
	if (!m) {
		console.error('[host] plugin/plugin.ts 未找到 manifest.name');
		process.exit(1);
	}
	return m[1];
}

const NAME = pluginName();
const PLUGIN_DEST = path.join(HOST, 'data/plugins', NAME);

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const SYNC_ONLY = args.includes('--sync');

function sh(cmd, cmdArgs, opts = {}) {
	// Node ≥22 禁止无 shell 直启 .cmd（pnpm 在 Windows 是 cmd shim，EINVAL）；
	// 统一经 cmd /c 解析 PATH
	if (process.platform === 'win32') {
		execFileSync('cmd.exe', ['/c', cmd, ...cmdArgs], { stdio: 'inherit', ...opts });
	} else {
		execFileSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
	}
}

function hostCloned() {
	return existsSync(path.join(HOST, 'package.json'));
}

function rmrf(dir) {
	// 整体移除自建运行副本。统一走 cmd.exe/rm 显式解释器——裸 'cmd' 在部分
	// Windows 环境 spawn 直接 EPERM（与 pnpm shim EINVAL 同一族问题）
	if (process.platform === 'win32') {
		execFileSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', dir], { stdio: 'ignore' });
	} else {
		execFileSync('rm', ['-rf', dir], { stdio: 'ignore' });
	}
}

function syncPlugin() {
	const exists = lstatSync(PLUGIN_DEST, { throwIfNoEntry: false });
	if (exists) {
		// 陈旧副本整体移除再拷（静默合并会留已删文件）。宿主 dev 运行中其
		// watcher 可能锁住文件致删除失败（Windows EPERM）——降级为增量覆盖
		// （可能残留已删文件，dev 期可接受），不阻断热同步。
		try {
			rmrf(PLUGIN_DEST);
		} catch {
			console.warn('[host] 运行副本被占用（宿主 dev watcher？），改为增量覆盖同步');
		}
	}
	mkdirSync(path.dirname(PLUGIN_DEST), { recursive: true });
	cpSync(PLUGIN_SRC, PLUGIN_DEST, {
		recursive: true,
		// 测试与 e2e 不进宿主（运行副本只留发布物等价内容）
		filter: (src) => !/\.test\.ts$|(^|[/\\])e2e([/\\]|$)/.test(src.replaceAll('\\', '/'))
	});
}

function ensure() {
	if (!hostCloned()) {
		console.log(`[host] 首次装配：clone ${REPO} (${REF}) → .sveltecms/（几分钟）`);
		try {
			sh('git', ['clone', '--depth', '1', '--branch', REF, REPO, HOST]);
		} catch {
			// 不甩 Node 栈：这条失败在 CI 上是结构性的，不是瞬时抖动
			console.error(`[host] clone 失败：${REPO}`);
			console.error(
				'[host] 若在 GitHub Actions 等境外 runner 上运行：默认源是 gitee，而 gitee 常直接重置境外连接。'
			);
			console.error('[host] 二选一：');
			console.error(
				'[host]   ① 给框架仓加一个 GitHub 镜像，并只在该 workflow 里设 SVELTECMS_REPO 指它'
			);
			console.error('[host]      （本地开发者仍走默认的 gitee，两边互不影响）');
			console.error(
				'[host]   ② 把需要宿主的 job（test/check/e2e）放到国内可达的 runner 上跑'
			);
			process.exit(1);
		}
	} else if (process.env.SVELTECMS_HOST_PULL === '1') {
		// 可选增量（默认关——装配后宿主锁定在 clone 时的 commit，行为可复现）
		console.log('[host] git pull --depth 1…');
		sh('git', ['pull', '--depth', '1', 'origin', REF], { cwd: HOST });
	}
	if (!existsSync(path.join(HOST, 'node_modules'))) {
		console.log('[host] 安装框架依赖 pnpm install（一次性，较慢）…');
		sh('pnpm', ['install', '--prefer-offline'], { cwd: HOST });
	}
	// 半成品防护：install 被中断会留下缺文件的 node_modules，而 pnpm 状态文件
	// 记为已完成——普通 install 不补链，dev 期才炸 ERR_MODULE_NOT_FOUND。
	// 探测宿主关键入口（better-auth 子路径），缺失时给出确切修复指令。
	if (!existsSync(path.join(HOST, 'node_modules/better-auth/dist/auth/minimal.mjs'))) {
		console.error(
			'[host] .sveltecms/node_modules 疑似半成品（better-auth dist 缺文件，常见于 install 被中断）'
		);
		console.error(`[host] 修复：pnpm --dir "${HOST}" install --force`);
		process.exit(1);
	}
	if (!existsSync(path.join(HOST, '.svelte-kit/tsconfig.json'))) {
		sh('pnpm', ['exec', 'svelte-kit', 'sync'], { cwd: HOST });
	}
	// 脚手架契约：drizzle/ 迁移不入 git，fresh clone 缺它则 dev 启动 runMigrations
	// 必炸——秒级确定性代码生成（不连库），装配阶段补做
	if (!existsSync(path.join(HOST, 'drizzle/meta/_journal.json'))) {
		console.log('[host] 生成系统表迁移 drizzle/（drizzle-kit generate）…');
		sh('pnpm', ['exec', 'drizzle-kit', 'generate'], {
			cwd: HOST,
			env: { ...process.env, DATABASE_URL: 'file:./data/local.db' }
		});
	}
	// paraglide 文案层是生成物（宿主 .gitignore 排除）——fresh clone 显式补
	if (!existsSync(path.join(HOST, 'src/lib/paraglide/messages'))) {
		sh(
			'pnpm',
			[
				'exec',
				'paraglide-js',
				'compile',
				'--project',
				'./project.inlang',
				'--outdir',
				'./src/lib/paraglide'
			],
			{ cwd: HOST }
		);
	}
	syncPlugin();
}

if (CHECK) {
	const ok =
		hostCloned() &&
		existsSync(path.join(HOST, 'node_modules')) &&
		existsSync(path.join(HOST, '.svelte-kit/tsconfig.json')) &&
		existsSync(path.join(HOST, 'src/lib/paraglide/messages'));
	if (!ok) {
		console.error(
			'[host] .sveltecms 未装配——先运行 pnpm dev / pnpm test（会自动装配），或手动 pnpm ensure'
		);
		process.exit(1);
	}
	process.exit(0);
}

if (SYNC_ONLY) {
	if (!hostCloned()) {
		console.error('[host] .sveltecms 不存在——先运行 pnpm dev（自动 clone 装配）');
		process.exit(1);
	}
	syncPlugin();
	console.log(`[host] 插件源码已同步进 .sveltecms/data/plugins/${NAME}/`);
	process.exit(0);
}

ensure();
