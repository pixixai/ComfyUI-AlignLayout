import { app } from "../../scripts/app.js";

/**
 * AutoLayout 插件全局配置中心
 * 1. 使用 category: ["分类", "分组", "唯一标签"] 的三级结构防止覆盖
 * 2. ID 已统一修改为 AutoLayout.Key
 */
app.registerExtension({
    name: "Comfy.AutoLayout.Config",
    settings: [

        // 7. 垂直间距
        {
            id: "AutoLayout.VerticalGap",
            name: "Vertical Spacing",
            type: "number",
            defaultValue: 60,
            category: ["AlignLayout", "Auto Layout", "Vertical Spacing"],
            attrs: { min: 20, max: 1000, step: 10, showButtons: true },
            tooltip: "The vertical space between nodes in the same column."
        },

        // 6. 水平间距
        {
            id: "AutoLayout.HorizontalGap",
            name: "Horizontal Spacing",
            type: "number",
            defaultValue: 80,
            category: ["AlignLayout", "Auto Layout", "Horizontal Spacing"],
            attrs: { min: 20, max: 1000, step: 10, showButtons: true },
            tooltip: "The horizontal space between columns."
        },

        // 5. 孤岛间距
        {
            id: "AutoLayout.IslandGap",
            name: "Island Spacing",
            type: "number",
            defaultValue: 150,
            category: ["AlignLayout", "Auto Layout", "Island Spacing"],
            attrs: { min: 0, max: 2000, step: 10, showButtons: true },
            tooltip: "The spacing between disconnected node groups (islands)."
        },

        // 4. 孤岛排列方向
        {
            id: "AutoLayout.IslandDirection",
            name: "Island Layout Direction",
            type: "combo",
            defaultValue: "Vertical",
            category: ["AlignLayout", "Auto Layout", "Island Direction"],
            options: [
                { text: "Vertical (Top to Bottom)", value: "Vertical" },
                { text: "Horizontal (Side by Side)", value: "Horizontal" }
            ],
            tooltip: "How to arrange multiple disconnected workflows."
        },

        // 3. 布局方向
        {
            id: "AutoLayout.Direction",
            name: "Layout Direction",
            type: "combo",
            defaultValue: "Right-to-Left",
            category: ["AlignLayout", "Auto Layout", "Layout Direction"],
            options: [
                { text: "Right-to-Left (Reverse)", value: "Right-to-Left" },
                { text: "Left-to-Right (Standard)", value: "Left-to-Right" }
            ],
            tooltip: "Choose the direction for the auto-layout algorithm."
        },

        // 2. 快捷键
        {
            id: "AutoLayout.Shortcut",
            name: "Shortcut",
            type: "text",
            defaultValue: "Alt+L",
            category: ["AlignLayout", "Auto Layout", "Shortcut"],
            tooltip: "Shortcut key combination (e.g., Alt+L).",
            attrs: { placeholder: "e.g., Alt+L" }
        },

        // 1. 总开关
        {
            id: "AutoLayout.Enabled",
            name: "Enable Auto Layout",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "Auto Layout", "Enable Feature"],
            tooltip: "Enable or disable the auto layout functionality."
        }
    ]
});