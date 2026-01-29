import { app } from "../../scripts/app.js";

// =========================================================
// 插件: NodeAligner (节点对齐助手) 设置
// =========================================================

// 定义通用的功能选项列表
const alignOptions = [
    { text: "Align Top", value: "top" },
    { text: "Align Bottom", value: "bottom" },
    { text: "Align Left", value: "left" },
    { text: "Align Right", value: "right" },
    { text: "Center Vertically", value: "v_center" },
    { text: "Center Horizontally", value: "h_center" },
    { text: "Distribute Vertically", value: "dist_v_gap" },
    { text: "Distribute Horizontally", value: "dist_h_gap" },
    { text: "Stack Vertically", value: "spacing_dist_v" },
    { text: "Stack Horizontally", value: "spacing_dist_h" },
    { text: "Auto Layout", value: "auto_layout" }
];

// 将设置项定义提取到数组中，以便"恢复默认"功能可以动态读取默认值
const nodeAlignerSettings = [
    // --- 环形菜单按钮自定义 ---
    {
        id: "NodeAligner.Btn.Top",
        name: "Ring Top",
        type: "combo",
        defaultValue: "top",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Top"],
        tooltip: "Action for the Top position (12 o'clock)."
    },
    {
        id: "NodeAligner.Btn.TopRight",
        name: "Ring Top-Right",
        type: "combo",
        defaultValue: "v_center",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Top-Right"],
        tooltip: "Action for the Top-Right position."
    },
    {
        id: "NodeAligner.Btn.Right",
        name: "Ring Right",
        type: "combo",
        defaultValue: "right",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Right"],
        tooltip: "Action for the Right position (3 o'clock)."
    },
    {
        id: "NodeAligner.Btn.BottomRight",
        name: "Ring Bottom-Right",
        type: "combo",
        defaultValue: "dist_h_gap",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Bottom-Right"],
        tooltip: "Action for the Bottom-Right position."
    },
    {
        id: "NodeAligner.Btn.Bottom",
        name: "Ring Bottom",
        type: "combo",
        defaultValue: "bottom",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Bottom"],
        tooltip: "Action for the Bottom position (6 o'clock)."
    },
    {
        id: "NodeAligner.Btn.BottomLeft",
        name: "Ring Bottom-Left",
        type: "combo",
        defaultValue: "dist_v_gap",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Bottom-Left"],
        tooltip: "Action for the Bottom-Left position."
    },
    {
        id: "NodeAligner.Btn.Left",
        name: "Ring Left",
        type: "combo",
        defaultValue: "left",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Left"],
        tooltip: "Action for the Left position (9 o'clock)."
    },
    {
        id: "NodeAligner.Btn.TopLeft",
        name: "Ring Top-Left",
        type: "combo",
        defaultValue: "h_center",
        options: alignOptions,
        category: ["AlignLayout", "NodeAligner", "Button Top-Left"],
        tooltip: "Action for the Top-Left position."
    },

    // --- 默认间距设置 ---
    {
        id: "NodeAligner.DefaultGap.H",
        name: "Default Horizontal Spacing",
        type: "number",
        defaultValue: 50,
        category: ["AlignLayout", "NodeAligner", "Default Gap H"],
        attrs: { min: 0, max: 500, step: 10 },
        tooltip: "Default value for horizontal spacing when using spacing distribution."
    },
    {
        id: "NodeAligner.DefaultGap.V",
        name: "Default Vertical Spacing",
        type: "number",
        defaultValue: 50,
        category: ["AlignLayout", "NodeAligner", "Default Gap V"],
        attrs: { min: 0, max: 500, step: 10 },
        tooltip: "Default value for vertical spacing when using spacing distribution."
    },

    // --- 行为与外观设置 ---
    {
        id: "NodeAligner.FlickSpeed",
        name: "Flick Speed",
        type: "slider",
        defaultValue: 0.6,
        category: ["AlignLayout", "NodeAligner", "Flick Speed"],
        attrs: { min: 0.1, max: 3.0, step: 0.1 },
        tooltip: "Higher value requires faster movement to trigger the gesture."
    },
    {
        id: "NodeAligner.FlickDistance",
        name: "Flick Distance",
        type: "slider",
        defaultValue: 80,
        category: ["AlignLayout", "NodeAligner", "Flick Distance"],
        attrs: { min: 20, max: 200, step: 5 },
        tooltip: "The pixel distance the mouse must move to start a gesture."
    },
    {
        id: "NodeAligner.Radius",
        name: "Menu Radius",
        type: "slider",
        defaultValue: 140,
        category: ["AlignLayout", "NodeAligner", "Menu Radius"],
        attrs: { min: 80, max: 300, step: 10 },
        tooltip: "The size (radius) of the radial menu."
    },
    {
        id: "NodeAligner.Shortcut",
        name: "Shortcut",
        type: "text",
        defaultValue: "Alt+A",
        category: ["AlignLayout", "NodeAligner", "Shortcut"],
        tooltip: "Key combination to trigger the menu (e.g., Alt+A, Ctrl+Q).",
        attrs: { placeholder: "e.g., Alt+A" }
    },
    {
        id: "NodeAligner.Enabled",
        name: "Enable Node Aligner",
        type: "boolean",
        defaultValue: true,
        category: ["AlignLayout", "NodeAligner", "Enable Feature"],
        tooltip: "Enable or disable the node aligner feature."
    }
];

// 定义"恢复默认"的特殊设置项
const resetSetting = {
    id: "NodeAligner.ResetAll",
    // 移除了 [Action] 前缀
    name: "Restore Default Settings",
    type: "boolean",
    defaultValue: false,
    // 修改了分类名称
    category: ["AlignLayout", "NodeAligner", "RestoreDefaultSettings"], 
    tooltip: "⚠️ WARNING: Click to RESET all AlignLayout settings. The switch will auto-off after execution.",
    onChange: async (newVal, oldVal) => {
        // 只有当用户将其打开 (true) 时才触发，防止重置回 false 时死循环
        if (newVal === true) {
            // 1. 弹出确认框 (使用浏览器原生 confirm)，防止误触
            const confirmed = confirm("Are you sure you want to reset all NodeAligner settings to defaults?");

            if (confirmed) {
                // 2. 遍历上面定义的 nodeAlignerSettings 数组
                for (const setting of nodeAlignerSettings) {
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
                app.extensionManager.setting.set("NodeAligner.ResetAll", false);
            }, 100);
        }
    }
};

// 注册扩展
app.registerExtension({
    name: "Comfy.NodeAligner.Settings",
    // 将普通设置和重置按钮合并
    settings: [...nodeAlignerSettings, resetSetting]
});