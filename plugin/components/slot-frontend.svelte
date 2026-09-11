<!--
	[示例·前台插槽组件] 注册到 frontend:content-after，渲染在主题正文之后。

	约定（评论插件同款，踩坑经验）：
	1. 整块挂在 mounted 之后——SSR/水合两侧渲染一致，且匿名页可能有公共缓存，
	   实时数据一律客户端 fetch 自家 public 端点；
	2. 文案不内嵌双语——ctx.i18n 注册后 loadPluginMessages 按当前语言下发；
	3. 样式只用主题 CSS 变量（--radius-*/--color-* 等），双主题自动适配，
	   不硬编码颜色；轻量卡片优先，与主题内容区呼吸一致。
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadPluginMessages } from '$lib/cms/utils/i18n-client';

	const BASE = '/api/v1/plugin/my-plugin';

	let mounted = $state(false);
	let messages = $state<Record<string, string>>({});
	let items = $state<Array<{ id: string; title: string }>>([]);
	/** 登录态随 /whoami 下发（better-auth 不走 HTTP，前端无法自行探测会话） */
	let viewer = $state<{ name: string } | null>(null);

	/** 取词：未注册键回退键名（fail-safe）；messages 是 $state，读取即响应 */
	function tr(key: string): string {
		return messages[key] ?? key;
	}

	onMount(async () => {
		mounted = true;
		loadPluginMessages('my-plugin').then((m) => (messages = m));
		try {
			const [res, who] = await Promise.all([
				fetch(`${BASE}/items?limit=5`),
				fetch(`${BASE}/whoami`)
			]);
			if (res.ok) items = (await res.json()).items ?? [];
			if (who.ok) viewer = (await who.json()).viewer ?? null;
		} catch {
			/* 端点不可达时静默（不阻塞页面） */
		}
	});
</script>

{#if mounted && items.length > 0}
	<section class="tpl-block">
		<h3 class="tpl-title">{tr('frontend_title')}</h3>
		{#if viewer}<p class="tpl-viewer">👋 {viewer.name}</p>{/if}
		<ul class="tpl-list">
			{#each items as item (item.id)}
				<li>{item.title}</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.tpl-block {
		margin: 2rem 0;
		padding: 1.25rem 1.5rem;
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: var(--radius-md, 8px);
		background: var(--color-surface, transparent);
	}
	.tpl-title {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	.tpl-viewer {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		opacity: 0.8;
	}
	.tpl-list {
		margin: 0;
		padding-left: 1.25rem;
		line-height: 1.9;
	}
</style>
