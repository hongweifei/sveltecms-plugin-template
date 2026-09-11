import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { baseColumns } from '$lib/cms/db/schema-helpers';

/**
 * 插件数据表。两条命名规则（都是引擎硬校验，写错注册即失败）：
 * 1. 物理表名必须 `plugin_<插件名>_` 前缀（SEC-5 沙箱按它判定归属；插件名
 *    可含连字符，如本例 my-plugin → 表名 plugin_my-plugin_items）；
 * 2. 默认导出的 key 必须等于集合 slug（PLN-2：集合必有同名 schema 表），
 *    而 slug 受 SAFE_SLUG_RE 约束 = 字母开头、仅字母数字下划线——不含连字符。
 * baseColumns 提供 id(uuidv7)/createdAt/updatedAt；列名 snake_case、
 * 字段名 camelCase（drizzle 第二参映射）。
 */
const items = sqliteTable(
	'plugin_my-plugin_items',
	{
		...baseColumns(),
		title: text('title').notNull(),
		note: text('note')
	},
	(t) => [index('plugin_my_plugin_items_title_idx').on(t.title)]
);

export default { my_plugin_items: items };
