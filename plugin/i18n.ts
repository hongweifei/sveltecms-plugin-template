/**
 * 插件文案：一次注册，前后台共用。
 * - 服务端：ctx.i18n.t('greeting', locale)
 * - 前台组件：loadPluginMessages('my-plugin') 经 /api/v1/i18n/my-plugin 拉取
 *   （按访客当前语言下发，组件不再自带双语）
 * key 用语义名，别与宿主/其他插件撞（本插件命名空间天然隔离，但同一插件内
 * 前后共用一份，起清楚的名字）。
 */
export const messages: Record<string, { zh: string; en: string }> = {
	greeting: { zh: '来自模板插件的问候', en: 'Greetings from the plugin template' },
	frontend_title: { zh: '模板插件区块', en: 'Template Plugin Block' },
	admin_title: { zh: '模板插件设置', en: 'Template Plugin Settings' },
	field_label: { zh: '示例字段', en: 'Sample field' }
};
