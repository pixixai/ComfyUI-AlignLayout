import { app } from "../../scripts/app.js";

/**
 * 插件: 选择相同节点 - 设置模块
 * 仅负责在 ComfyUI 设置面板中注册相关配置项
 */
app.registerExtension({
    name: "Comfy.AlignLayout.SelectSame.Settings",
    settings: [
        {
            id: "AlignLayout.SelectSame.Shortcut",
            name: "Shortcut",
            type: "text",
            defaultValue: "Shift+A",
            category: ["AlignLayout", "Select Same", "Shortcut"],
            tooltip: "自定义快捷键 (例如: Shift+A, Ctrl+Alt+S)。",
            attrs: { placeholder: "e.g., Shift+A" }
        },
        {
            id: "AlignLayout.SelectSame.Enabled",
            name: "Enable Select Same Nodes",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "Select Same", "Enable Feature"],
            tooltip: "是否启用“选择相同节点”功能。"
        }
    ]
});