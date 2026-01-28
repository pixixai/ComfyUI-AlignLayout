import { app } from "../../scripts/app.js";

/**
 * 插件: 替换节点 - 设置模块
 * 注册相关的设置项
 * 注意：ComfyUI 设置项显示顺序通常为“后注册的先显示”(LIFO)或依赖具体实现，
 * 这里按照用户要求反转了代码顺序，将核心开关放在最后注册（以便在 UI 顶部显示）。
 */
app.registerExtension({
    name: "Comfy.AlignLayout.ReplaceNode.Settings",
    settings: [

        // 8. 描边粗细
        {
            id: "AlignLayout.ReplaceNode.StrokeWidth",
            name: "Stroke Width",
            type: "slider",
            defaultValue: 3,
            min: 1,
            max: 10,
            step: 1,
            category: ["AlignLayout", "Replace Node", "Stroke Width"],
            tooltip: "Thickness of the highlight border."
        },
        // 7. 发光强度
        {
            id: "AlignLayout.ReplaceNode.GlowStrength",
            name: "Glow Strength",
            type: "slider",
            defaultValue: 15,
            min: 0,
            max: 50,
            step: 1,
            category: ["AlignLayout", "Replace Node", "Glow Strength"],
            tooltip: "Strength (blur radius) of the glow effect."
        },
        // 6. 填充透明度
        {
            id: "AlignLayout.ReplaceNode.Opacity",
            name: "Fill Opacity",
            type: "slider",
            defaultValue: 0.15,
            min: 0.0,
            max: 1.0,
            step: 0.05,
            category: ["AlignLayout", "Replace Node", "Fill Opacity"],
            tooltip: "Opacity of the highlight fill (0.0 - 1.0)."
        },
        // 5. 高亮颜色
        {
            id: "AlignLayout.ReplaceNode.BorderColor",
            name: "Highlight Color",
            type: "text",
            defaultValue: "#FFFF00",
            category: ["AlignLayout", "Replace Node", "Highlight Color"],
            tooltip: "The hex color code for the highlight border and fill base."
        },
        // 4. 菜单触发方式 (Category 独立，增加 QuickNodeMenu 选项，默认 SearchBox)
        {
            id: "AlignLayout.ReplaceNode.MenuTrigger",
            name: "Auto Open Menu",
            type: "combo",
            defaultValue: "SearchBox",
            options: [
                { text: "None", value: "None" },
                { text: "Search Box (Default)", value: "SearchBox" },
                { text: "Add Node Menu (All)", value: "AddNodeMenu" },
                { text: "Quick Node Menu (Favorites)", value: "QuickNodeMenu" }
            ],
            category: ["AlignLayout", "Replace Node", "Menu Trigger"], // 修改这里，防止覆盖
            tooltip: "What to open automatically after entering replace mode."
        },
        // 3. 强制连接
        {
            id: "AlignLayout.ReplaceNode.ForceConnect",
            name: "Force Connection",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "Replace Node", "Behavior"],
            tooltip: "If enabled, attempts to connect inputs/outputs sequentially even if types do not match."
        },
        // 2. 快捷键
        {
            id: "AlignLayout.ReplaceNode.Shortcut",
            name: "Shortcut",
            type: "text",
            defaultValue: "Shift+R",
            category: ["AlignLayout", "Replace Node", "Shortcut"],
            tooltip: "Shortcut key combination (e.g., Shift+R).",
            attrs: { placeholder: "e.g., Shift+R" }
        },
        // 1. 核心开关
        {
            id: "AlignLayout.ReplaceNode.Enabled",
            name: "Enable Replace Node",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "Replace Node", "Enable Feature"],
            tooltip: "Enable or disable the replace node functionality."
        }
    ]
});