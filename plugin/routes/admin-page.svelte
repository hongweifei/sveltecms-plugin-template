<!--
	[示例·后台路由页] 注册到 /admin/plugin-pages/my-plugin（ctx.route）。
	数据经自家端点 fetch（后台路由下自动带管理员会话）。进阶：可用框架的
	ListPage/FormPage 组件（$lib/cms/components/page/*）搭管理界面。
-->
<script lang="ts">
	import { onMount } from 'svelte';

	const BASE = '/api/v1/plugin/my-plugin';

	let itemTotal = $state<number | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`${BASE}/items?limit=1`);
			if (res.ok) itemTotal = (await res.json()).total ?? 0;
		} catch {
			/* ignore */
		}
	});
</script>

<div class="page">
	<h2>模板插件</h2>
	<p class="desc">
		这是插件路由渲染的后台页面（plugin/routes/admin-page.svelte）。数据来自自家
		API 端点 <code>{BASE}/items</code>。
	</p>
	<div class="stat">
		<span class="stat-label">条目总数</span>
		<span class="stat-value">{itemTotal ?? '—'}</span>
	</div>
</div>

<style>
	.page {
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg, 12px);
		background: var(--color-bg);
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
		color: var(--color-text);
	}
	.desc {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: var(--color-text-secondary, inherit);
	}
	.desc code {
		padding: 0.1rem 0.35rem;
		font-size: 0.85em;
		background: var(--color-bg-tertiary, rgba(127, 127, 127, 0.12));
		border-radius: 4px;
	}
	.stat {
		display: inline-flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
	}
	.stat-label {
		font-size: 0.8rem;
		color: var(--color-text-secondary, inherit);
	}
	.stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-text);
	}
</style>
