import { app } from "../../scripts/app.js";

// =========================================================
// 插件: NodeResizer (节点拉伸助手) 设置
// =========================================================

// 定义通用的拉伸功能选项列表 (纯英文)
const stretchOptions = [
    { text: "Stretch Top", value: "stretch_top" },
    { text: "Stretch Bottom", value: "stretch_bottom" },
    { text: "Stretch Left", value: "stretch_left" },
    { text: "Stretch Right", value: "stretch_right" },
    { text: "Stretch H-Max", value: "h_max" },
    { text: "Stretch V-Max", value: "v_max" },
    { text: "Default Size (320px)", value: "def_size" },
    { text: "Min Size", value: "min_size" }
];

// 将设置项定义提取到数组中，以便"恢复默认"功能可以动态读取默认值
const nodeResizerSettings = [
    // --- 按钮自定义设置 (放在最前以适应"先进后出"的显示逻辑) ---
    
    // 环形菜单按钮 (顺时针/方位顺序)
    {
        id: "NodeResizer.Btn.Top",
        name: "Ring Top",
        type: "combo",
        defaultValue: "stretch_top",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Top"],
        tooltip: "Action for the Top position (12 o'clock)."
    },
    {
        id: "NodeResizer.Btn.TopRight",
        name: "Ring Top-Right",
        type: "combo",
        defaultValue: "v_max",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Top-Right"],
        tooltip: "Action for the Top-Right position."
    },
    {
        id: "NodeResizer.Btn.Right",
        name: "Ring Right",
        type: "combo",
        defaultValue: "stretch_right",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Right"],
        tooltip: "Action for the Right position (3 o'clock)."
    },
    {
        id: "NodeResizer.Btn.BottomRight",
        name: "Ring Bottom-Right",
        type: "combo",
        defaultValue: "def_size",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Bottom-Right"],
        tooltip: "Action for the Bottom-Right position."
    },
    {
        id: "NodeResizer.Btn.Bottom",
        name: "Ring Bottom",
        type: "combo",
        defaultValue: "stretch_bottom",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Bottom"],
        tooltip: "Action for the Bottom position (6 o'clock)."
    },
    {
        id: "NodeResizer.Btn.BottomLeft",
        name: "Ring Bottom-Left",
        type: "combo",
        defaultValue: "min_size",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Bottom-Left"],
        tooltip: "Action for the Bottom-Left position."
    },
    {
        id: "NodeResizer.Btn.Left",
        name: "Ring Left",
        type: "combo",
        defaultValue: "stretch_left",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Left"],
        tooltip: "Action for the Left position (9 o'clock)."
    },
    {
        id: "NodeResizer.Btn.TopLeft",
        name: "Ring Top-Left",
        type: "combo",
        defaultValue: "h_max",
        options: stretchOptions,
        category: ["AlignLayout", "NodeResizer", "Button Top-Left"],
        tooltip: "Action for the Top-Left position."
    },

    // --- 原有设置 ---

    // 5. 手势行为设置 (甩动速度)
    {
        id: "NodeResizer.FlickSpeed",
        name: "Flick Speed",
        type: "slider",
        defaultValue: 0.6,
        category: ["AlignLayout", "NodeResizer", "Flick Speed"],
        attrs: { min: 0.1, max: 3.0, step: 0.1 },
        tooltip: "Higher value requires faster movement to trigger the gesture."
    },

    // 4. 手势行为设置 (甩动距离)
    {
        id: "NodeResizer.FlickDistance",
        name: "Flick Distance",
        type: "slider",
        defaultValue: 80,
        category: ["AlignLayout", "NodeResizer", "Flick Distance"],
        attrs: { min: 20, max: 200, step: 5 },
        tooltip: "The pixel distance the mouse must move to start a gesture."
    },

    // 3. 菜单外观设置
    {
        id: "NodeResizer.Radius",
        name: "Menu Radius",
        type: "slider",
        defaultValue: 140,
        category: ["AlignLayout", "NodeResizer", "Menu Radius"],
        attrs: { min: 80, max: 300, step: 10 },
        tooltip: "The size (radius) of the radial menu."
    },

    // 2. 快捷键设置 (文本输入)
    {
        id: "NodeResizer.Shortcut",
        name: "Shortcut",
        type: "text",
        defaultValue: "Alt+S",
        category: ["AlignLayout", "NodeResizer", "Shortcut"],
        tooltip: "Key combination to trigger the menu (e.g., Alt+S).",
        attrs: { placeholder: "e.g., Alt+S" }
    },

    // 1. 总开关
    {
        id: "NodeResizer.Enabled",
        name: "Enable Node Resizer",
        type: "boolean",
        defaultValue: true,
        category: ["AlignLayout", "NodeResizer", "Enable Feature"],
        tooltip: "Enable or disable the node resizer feature."
    }
];

// 定义"恢复默认"的特殊设置项
const resetSetting = {
    id: "NodeResizer.ResetAll",
    name: "Restore Default Settings",
    type: "boolean",
    defaultValue: false,
    category: ["AlignLayout", "NodeResizer", "RestoreDefaultSettings"], 
    tooltip: "⚠️ WARNING: Click to RESET all NodeResizer settings. The switch will auto-off after execution.",
    onChange: async (newVal, oldVal) => {
        if (newVal === true) {
            const confirmed = confirm("Are you sure you want to reset all NodeResizer settings to defaults?");

            if (confirmed) {
                for (const setting of nodeResizerSettings) {
                    try {
                        await app.extensionManager.setting.set(setting.id, setting.defaultValue);
                    } catch (e) {
                        console.error(`Failed to reset ${setting.id}`, e);
                    }
                }
            }

            setTimeout(() => {
                app.extensionManager.setting.set("NodeResizer.ResetAll", false);
            }, 100);
        }
    }
};

app.registerExtension({
    name: "Comfy.NodeResizer.Settings",
    // 将普通设置和重置按钮合并
    settings: [...nodeResizerSettings, resetSetting]
});