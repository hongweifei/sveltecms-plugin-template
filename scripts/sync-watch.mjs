/**
 * 插件源码热同步：watch plugin/，变更即拷进宿主运行副本（.sveltecms/data/
 * plugins/<name>/），宿主 vite 的 watcher 随即 HMR——改插件代码 → 浏览器
 * 秒级生效（组件与前端模块）。
 *
 * 注意：插件服务端代码（api/plugin.ts 等，SSR import 链）不随文件同步热
 * 重载——生效需后台「插件管理 → 重载」或重启 dev。
 */
import { watch, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'plugin');

if (!existsSync(path.join(ROOT, '.sveltecms/package.json'))) {
	console.error('[watch] .sveltecms 不存在——先运行 pnpm dev / pnpm ensure');
	process.exit(1);
}

let timer = null;
let dirty = false;

function sync() {
	const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/ensure-host.mjs'), '--sync'], {
		stdio: ['ignore', 'ignore', 'inherit']
	});
	if (r.status !== 0) console.error('[watch] 同步失败（见上）');
	else if (dirty) console.log('[watch] 已同步 → .sveltecms/data/plugins/');
	dirty = false;
}

// 编辑器保存常触发连串事件：200ms 去抖合并成一次全量同步（目录小，成本可忽略）
function schedule() {
	dirty = true;
	if (timer) clearTimeout(timer);
	timer = setTimeout(sync, 200);
}

watch(SRC, { recursive: true }, (_event, filename) => {
	if (!filename) return;
	const rel = filename.toString();
	// 测试与 e2e 不进宿主，无需为其变更触发同步
	if (/\.test\.ts$|^e2e[/\\]/.test(rel)) return;
	schedule();
});

console.log('[watch] 监听 plugin/ → .sveltecms/data/plugins/（Ctrl+C 退出）');
