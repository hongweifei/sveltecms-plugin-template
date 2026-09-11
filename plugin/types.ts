import type { InferSelectModel } from 'drizzle-orm';
import schema from './schema';

/**
 * 类型化数据访问——db 沙箱返回 Record<string, unknown>，直接写每个字段都要
 * 手动转型（"硬写"）。这里给插件的行类型一个正式定义，消费侧用泛型参数：
 *
 *   const rows = await ctx.db.find<Item>('my_plugin_items', {...});
 *   rows.data.map((r) => r.title)   // string ✓ 编辑器可补全
 *
 * 下面的 Assignable 断言是同步保险：interface 一旦与 schema 漂移（漏列/类型
 * 不符），check 立即报错——手写的 interface 因此可信。
 */

/** 集合 my_plugin_items 的行（db.find/create 返回的扁平形态） */
export interface Item {
	id: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	/** 可空列（schema 未 notNull） */
	note: string | null;
}

// ── schema ↔ interface 一致性断言（漂移即编译错） ──────────────────
type DrizzleItem = InferSelectModel<typeof schema.my_plugin_items>;
type Assignable<To extends From, From> = From;
const _assertItem: Assignable<DrizzleItem, Item> = null as unknown as Item;
void _assertItem;
