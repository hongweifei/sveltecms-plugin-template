/**
 * 生成 npm 发布目录 dist/npm/。
 *
 * 为什么必须摊平：宿主的包发现 glob 是
 * node_modules/sveltecms-plugin-<name>/plugin.ts（只认包根一层），
 * 而模板源码在 plugin/ 子目录里。zip 那条能成立是因为 scripts/package.mjs
 * 把 plugin/ 的内容直接落在 zip 根——npm 走的是同一套摊平，两者共用一份
 * 「什么算发布物」的判断，不各说各话。不摊平发出去的包，宿主根本发现不了。
 *
 * 为什么模板自己的 package.json 保持 private: true：发布的是这里生成的
 * dist/npm/package.json（不带 private），模板仓自身永远发不出去——避免有人
 * 把 sveltecms-plugin-template 本身推上 registry，也免掉作者「改 private」这一步
 * 容易漏掉的坑。
 *
 * 用法：
 *   node scripts/prepare-npm-pkg.mjs          # 只生成
 *   node scripts/prepare-npm-pkg.mjs && npm publish ./dist/npm --access public
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'plugin');
const OUT = path.join(ROOT, 'dist', 'npm');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifestSource = readFileSync(path.join(SRC, 'plugin.ts'), 'utf8');
/** manifest 块内取字段——与宿主安装期的 extractManifestName 同口径（锚定 manifest: { ） */
function manifestField(key) {
	const m = new RegExp(`manifest\\s*:\\s*\\{[\\s\\S]{0,800}?\\b${key}\\s*:\\s*(['"])([^'"]+)\\1`).exec(
		manifestSource
	);
	return m?.[2]?.trim();
}

const name = pkg.name;
if (name === 'sveltecms-plugin-template') {
	console.error('[npm-pkg] 包名仍是模板默认名——先跑 node scripts/rename.mjs <name>');
	process.exit(1);
}
if (!name.startsWith('sveltecms-plugin-')) {
	console.error(
		`[npm-pkg] 包名 ${name} 不满足发现约定 sveltecms-plugin-<name>，宿主不会扫描到它`
	);
	process.exit(1);
}
const version = manifestField('version') ?? pkg.version;
if (!version) {
	console.error('[npm-pkg] 找不到版本号（plugin.ts 的 manifest.version 或 package.json.version）');
	process.exit(1);
}

// 与 package.mjs 同口径的排除规则：测试与 e2e 不是发布物
const isPublishable = (rel) => !/\.test\.ts$|(^|[/\\])e2e([/\\]|$)/.test(rel.replaceAll('\\', '/'));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const entry of readdirSync(SRC)) {
	const abs = path.join(SRC, entry);
	if (!isPublishable(entry) && !statSync(abs).isDirectory()) continue;
	if (statSync(abs).isDirectory()) {
		cpSync(abs, path.join(OUT, entry), { recursive: true, filter: (s) => isPublishable(s) });
	} else {
		cpSync(abs, path.join(OUT, entry));
	}
}

writeFileSync(
	path.join(OUT, 'package.json'),
	JSON.stringify(
		{
			name,
			version,
			description: manifestField('description') ?? pkg.description,
			type: 'module',
			main: './plugin.ts',
			exports: { '.': './plugin.ts' },
			// svelte 只有带组件的插件才需要；纯服务端插件不必拉这个 peer
			peerDependencies: { svelte: '^5.0.0' },
			peerDependenciesMeta: { svelte: { optional: true } }
		},
		null,
		'\t'
	) + '\n'
);

console.log(`[npm-pkg] 发布物已生成 → dist/npm/（${name}@${version}）`);
console.log('[npm-pkg] 试运行： npm publish ./dist/npm --dry-run');
console.log('[npm-pkg] 正式发布： npm publish ./dist/npm --access public');
