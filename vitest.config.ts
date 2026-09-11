import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * 测试配置：宿主框架在仓内 .sveltecms/（ensure-host 自动装配），$lib 解析到
 * .sveltecms/src/lib，mock 别名复用宿主 __mocks__。pnpm test 已前置 ensure。
 */
const HOST = path.resolve(__dirname, '.sveltecms');

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.join(HOST, 'src/lib'),
			'$env/dynamic/private': path.join(HOST, 'src/__mocks__/env.ts'),
			'$app/environment': path.join(HOST, 'src/__mocks__/app-environment.ts'),
			'$app/state': path.join(HOST, 'src/__mocks__/app-state.ts')
		}
	},
	// 组件渲染测试（svelte/server render）需要 Svelte 编译器；纯逻辑测试不受影响
	plugins: [
		svelte({
			compilerOptions: { runes: true },
			preprocess: [vitePreprocess()]
		})
	],
	test: {
		include: ['plugin/**/*.test.ts'],
		environment: 'node',
		globals: false,
		testTimeout: 30000,
		hookTimeout: 30000
	}
});
