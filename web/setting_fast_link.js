import { app } from "../../scripts/app.js";

// =========================================================
// 插件: Fast Link 设置注册
// =========================================================

// 将设置项定义提取到数组中，以便"恢复默认"功能可以动态读取默认值
const fastLinkSettings = [
    // 注意：ComfyUI 设置面板是“栈”结构（FILO），
    // 代码中写在前面的设置，在 UI 面板上会显示在“底部”。

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
];

// 定义"恢复默认"的特殊设置项
const resetSetting = {
    id: "FastLink.ResetAll",
    name: "Restore Default Settings",
    type: "boolean",
    defaultValue: false,
    category: ["AlignLayout", "FastLink", "RestoreDefaultSettings"], 
    tooltip: "⚠️ WARNING: Click to RESET all Fast Link settings. The switch will auto-off after execution.",
    onChange: async (newVal, oldVal) => {
        // 只有当用户将其打开 (true) 时才触发
        if (newVal === true) {
            // 1. 弹出确认框 (使用浏览器原生 confirm)，防止误触
            const confirmed = confirm("Are you sure you want to reset all Fast Link settings to defaults?");

            if (confirmed) {
                // 2. 遍历上面定义的 fastLinkSettings 数组写入默认值
                for (const setting of fastLinkSettings) {
                    try {
                        await app.extensionManager.setting.set(setting.id, setting.defaultValue);
                    } catch (e) {
                        console.error(`Failed to reset ${setting.id}`, e);
                    }
                }
            }

            // 3. 无论是否确认，都要把开关自动拨回 false
            setTimeout(() => {
                app.extensionManager.setting.set("FastLink.ResetAll", false);
            }, 100);
        }
    }
};

app.registerExtension({
    name: "Comfy.FastLink.Settings",
    // 将普通设置和重置按钮合并
    settings: [...fastLinkSettings, resetSetting]
});