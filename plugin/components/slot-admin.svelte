<!--
	[示例·管理端表单插槽组件] 注册到 collection-form-fields-after，渲染在
	内容编辑表单字段之后。FormPage 以 props 传入 contentType（集合 slug）与
	recordId（编辑对象 id，新建时 undefined）——组件按 contentType 判别门
	只在自己的集合上渲染（插槽对所有编辑表单广播，不做门控会到处冒出来）。

	进阶玩法（评论的内容级开关）：自有 KV 表存设置 + 调自家 admin 端点读写。
-->
<script lang="ts">
	const { contentType = undefined, recordId = undefined } = $props();

	// 判别门：只在模板集合的表单上渲染
	const applicable = $derived(contentType === 'my_plugin_items');

	let note = $state('');
</script>

{#if applicable}
	<div class="tpl-slot">
		<label class="tpl-label">
			插槽示例（编辑 {recordId ?? '新条目'} 时出现）
			<input class="tpl-input" type="text" bind:value={note} placeholder="这里挂插件自己的字段/设置" />
		</label>
	</div>
{/if}

<style>
	.tpl-slot {
		margin-top: 0.5rem;
	}
	.tpl-label {
		display: block;
		font-size: 0.85rem;
		opacity: 0.9;
	}
	.tpl-input {
		display: block;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.4rem 0.6rem;
		font: inherit;
		color: var(--color-text);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
	}
</style>
