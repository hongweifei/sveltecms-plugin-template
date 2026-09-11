/**
 * 插件 e2e 数据库重置：删本仓 e2e-data/（playwright.config 的 DATABASE_URL
 * 绝对指向这里，与 helpers 的相对路径在本仓 cwd 下解析为同一文件）。
 */
import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'e2e-data');
if (lstatSync(TARGET, { throwIfNoEntry: false })) {
	// 自建测试产物目录（非用户数据）。cmd.exe 显式解释器——裸 'cmd' 在部分
	// Windows 环境 spawn 直接 EPERM
	if (process.platform === 'win32') {
		execFileSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', TARGET], { stdio: 'ignore' });
	} else {
		execFileSync('rm', ['-rf', TARGET], { stdio: 'ignore' });
	}
}
console.log('[e2e] wiped e2e-data/');
