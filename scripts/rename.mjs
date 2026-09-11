/**
 * 一键改名：把模板标识符全量替换成你的插件名（Minecraft mod 模板式）。
 *
 *   node scripts/rename.mjs <kebab-name>      # 例：node scripts/rename.mjs hello-world
 *
 * 覆盖的 token（裸子串替换，长 token 先行——复合形态如表名
 * plugin_my-plugin_items、slug my_plugin_items 一并跟随）：
 *   my-plugin  → 你的 kebab 名（manifest.name / 路由 / 菜单 / API 前缀 / 表名前缀）
 *   my_plugin  → 下划线形态（集合 slug / schema key）
 *   My Plugin  → 英文显示名（labelI18n en）
 *   sveltecms-plugin-template → package.json 的 npm 名
 *
 * 不自动改的（猜错更糟，交给你）：中文文案（"模板插件"等）、icon、README
 * 叙述、删用不到的示例。改完跑 pnpm test / pnpm check 确认。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.join(ROOT, 'scripts', 'rename.mjs');
const SKIP_DIRS = new Set([
	'node_modules',
	'.sveltecms',
	'.git',
	'dist',
	'.svelte-kit',
	'test-results',
	'playwright-report',
	'e2e-data'
]);
const EXT = /\.(ts|js|mjs|svelte|json|md|yml|yaml)$/;

const name = process.argv[2];
if (!name) {
	console.error('用法: node scripts/rename.mjs <kebab-name>   例: hello-world');
	process.exit(1);
}
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
	console.error(`插件名需为 kebab-case（小写字母/数字，连字符分隔）：收到 "${name}"`);
	process.exit(1);
}
if (name === 'my-plugin') {
	console.error('新插件名与模板默认名相同，无需改名。');
	process.exit(1);
}

const under = name.replace(/-/g, '_');
const title = name
	.split('-')
	.map((s) => s[0].toUpperCase() + s.slice(1))
	.join(' ');

// 裸子串、长先行：sveltecms-plugin-template 最先（不含其余 token，序仅为稳）；
// my-plugin/my_plugin 互不为子串，任意序；复合 token（plugin_my-plugin_items、
// my_plugin_items）由子串替换自然覆盖。
const PAIRS = [
	[/sveltecms-plugin-template/g, `sveltecms-plugin-${name}`],
	[/my-plugin/g, name],
	[/my_plugin/g, under],
	[/My Plugin/g, title]
];

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const p = path.join(dir, entry);
		if (p === SELF) continue; // 本脚本自身含 token，跳过防自毁
		if (statSync(p).isDirectory()) {
			if (!SKIP_DIRS.has(entry)) out.push(...walk(p));
		} else if (EXT.test(entry)) out.push(p);
	}
	return out;
}

let touched = 0;
for (const file of walk(ROOT)) {
	const src = readFileSync(file, 'utf8');
	let cur = src;
	for (const [re, to] of PAIRS) cur = cur.replace(re, to);
	if (cur !== src) {
		writeFileSync(file, cur);
		touched++;
		console.log(`  ✓ ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
	}
}

console.log(
	`\n已改名：my-plugin → ${name}（${touched} 个文件）。` +
		`\n还需手动处理：中文文案（"模板插件"等）、icon、README 叙述、删不用的示例。` +
		`\n下一步：pnpm install && pnpm test && pnpm check`
);
