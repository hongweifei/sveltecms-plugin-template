/**
 * 编辑器/工具链的 Svelte 配置——**只管语言服务提示，不参与运行**（插件代码
 * 由宿主 vite 编译）。没有它，svelte-vscode 会按 Svelte 4 默认解析 .svelte：
 * $state/$derived/$props 全部标红、TS 块语法误报——开发者被迫"硬写"。
 * 配置需与宿主对齐（runes: true + vitePreprocess）。
 */
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: [vitePreprocess()],
	compilerOptions: {
		runes: true
	},
	extensions: ['.svelte']
};
