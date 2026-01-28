import { app } from "../../scripts/app.js";

// =========================================================
// 插件: Fast Link 设置注册
// =========================================================

app.registerExtension({
    name: "Comfy.FastLink.Settings",
    settings: [
        // 注意：ComfyUI 设置面板是“栈”结构（FILO），
        // 代码中写在前面的设置，在 UI 面板上会显示在“底部”。
        // 因此，我们将“端口匹配优先级”写在最前面，将“启用开关”写在最后面。

        // 5. 端口匹配优先级 (UI: 底部)
        {
            id: "FastLink.MatchStrategy",
            name: "Port Match Priority",
            type: "combo",
            defaultValue: "name_type",
            options: [
                { text: "Name + Type (Strict)", value: "name_type" },
                { text: "Type Only (Loose)", value: "type_only" }
            ],
            // Category: [插件名, 功能名, 设置名]
            category: ["AlignLayout", "FastLink", "Match Priority"], 
            tooltip: "Strict: Requires both name and type match. Loose: Only checks type."
        },

        // 4. 模式重置超时时间
        {
            id: "FastLink.ResetTimeout",
            name: "Mode Reset Timeout (ms)",
            type: "number",
            defaultValue: 2000,
            attrs: { min: 500, max: 10000, step: 100 },
            category: ["AlignLayout", "FastLink", "Reset Timeout"],
            tooltip: "Time in milliseconds before the multi-press cycle resets to default state."
        },

        // 3. 垂直堆叠判定阈值
        {
            id: "FastLink.VerticalThreshold",
            name: "Vertical Stack Threshold",
            type: "slider",
            defaultValue: 0.8,
            attrs: { min: 0.1, max: 1.0, step: 0.05 },
            category: ["AlignLayout", "FastLink", "Vertical Threshold"],
            tooltip: "Overlap ratio (0.0-1.0) required to treat nodes as a vertical column."
        },

        // 2. 快捷键
        {
            id: "FastLink.Shortcut",
            name: "Shortcut Key",
            type: "text",
            defaultValue: "F",
            attrs: { placeholder: "e.g. F" },
            category: ["AlignLayout", "FastLink", "Shortcut Key"],
            tooltip: "The main key to trigger Fast Link actions (Case insensitive)."
        },

        // 1. 启用开关 (UI: 顶部)
        {
            id: "FastLink.Enabled",
            name: "Enable Fast Link",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "FastLink", "Enable Plugin"],
            tooltip: "Master switch to enable or disable the Fast Link plugin."
        }
    ]
});