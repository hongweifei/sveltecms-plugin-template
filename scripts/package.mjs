/**
 * 打包发布 zip：plugin/ 内容直接落 zip 根（宿主安装器约定——plugin.ts 必须
 * 位于 zip 根目录，嵌套一层会被判 "Plugin zip missing plugin.ts" 并回滚）。
 *
 * 产出 dist/<name>-<version>.zip + 控制台打印 SHA-256（回填市场 static 项
 * 或核对 repo 项下载完整性）。name/version 读 plugin/plugin.ts 的 manifest。
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'plugin');

const manifest = readFileSync(path.join(SRC, 'plugin.ts'), 'utf8');
const name = /name:\s*'([^']+)'/.exec(manifest)?.[1];
const version = /version:\s*'([^']+)'/.exec(manifest)?.[1];
if (!name || !version) {
	console.error('[package] plugin.ts 未找到 name/version 字段');
	process.exit(1);
}

const zip = new AdmZip();
// 发布包只含运行文件：测试与 e2e 排除（与 ensure-host sync 同口径）。
// 路径为 zip 相对形态（如 e2e/x.spec.ts），顶层目录无前导分隔符
zip.addLocalFolder(SRC, undefined, (srcPath) =>
	!/\.test\.ts$|(^|[/\\])e2e([/\\]|$)/.test(srcPath.replaceAll('\\', '/'))
);
mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', `${name}-${version}.zip`);
zip.writeZip(out);
const sha = createHash('sha256').update(zip.toBuffer()).digest('hex');

console.log(`[package] ${path.relative(ROOT, out)}`);
console.log(`[package] sha256=${sha}`);
