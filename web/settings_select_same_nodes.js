import { app } from "../../scripts/app.js";

/**
 * 插件: 选择相同节点 - 设置模块
 * 仅负责在 ComfyUI 设置面板中注册相关配置项
 */

// 将设置项定义提取到数组中，以便"恢复默认"功能可以动态读取默认值
const selectSameSettings = [
    {
        id: "AlignLayout.SelectSame.Shortcut",
        name: "Shortcut",
        type: "text",
        defaultValue: "Shift+A",
        category: ["AlignLayout", "Select Same", "Shortcut"],
        tooltip: "Custom shortcut (e.g., Shift+A, Ctrl+Alt+S).",
        attrs: { placeholder: "e.g., Shift+A" }
    },
    {
        id: "AlignLayout.SelectSame.Enabled",
        name: "Enable Select Same Nodes",
        type: "boolean",
        defaultValue: true,
        category: ["AlignLayout", "Select Same", "Enable Feature"],
        tooltip: "Whether to enable the 'Select Same Nodes' feature."
    }
];

// 定义"恢复默认"的特殊设置项
const resetSetting = {
    id: "AlignLayout.SelectSame.ResetAll",
    name: "Restore Default Settings",
    type: "boolean",
    defaultValue: false,
    category: ["AlignLayout", "Select Same", "RestoreDefaultSettings"], 
    tooltip: "⚠️ WARNING: Click to RESET all Select Same settings. The switch will auto-off after execution.",
    onChange: async (newVal, oldVal) => {
        // 只有当用户将其打开 (true) 时才触发，防止重置回 false 时死循环
        if (newVal === true) {
            // 1. 弹出确认框 (使用浏览器原生 confirm)，防止误触
            const confirmed = confirm("Are you sure you want to reset all Select Same settings to defaults?");

            if (confirmed) {
                // 2. 遍历上面定义的 selectSameSettings 数组
                for (const setting of selectSameSettings) {
                    try {
                        // 写入默认值
                        await app.extensionManager.setting.set(setting.id, setting.defaultValue);
                    } catch (e) {
                        console.error(`Failed to reset ${setting.id}`, e);
                    }
                }
            }

            // 3. 无论是否确认，都要把开关自动拨回 false，以便下次使用
            setTimeout(() => {
                app.extensionManager.setting.set("AlignLayout.SelectSame.ResetAll", false);
            }, 100);
        }
    }
};

app.registerExtension({
    name: "Comfy.AlignLayout.SelectSame.Settings",
    // 将普通设置和重置按钮合并
    settings: [...selectSameSettings, resetSetting]
});