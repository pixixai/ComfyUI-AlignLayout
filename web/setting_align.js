import { app } from "../../scripts/app.js";

// =========================================================
// 插件: NodeAligner (节点对齐助手) 设置
// =========================================================

// 定义通用的功能选项列表 (纯英文)
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

app.registerExtension({
    name: "Comfy.NodeAligner.Settings",
    settings: [
        // --- 环形菜单按钮自定义 (放在最前) ---
        
        // 环形菜单按钮 (顺时针/方位顺序)
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

        // --- 默认间距设置 (新增) ---
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

        // --- 原有设置 ---
        
        // 5. 手势行为设置 (甩动速度)
        {
            id: "NodeAligner.FlickSpeed",
            name: "Flick Speed",
            type: "slider",
            defaultValue: 0.6,
            category: ["AlignLayout", "NodeAligner", "Flick Speed"],
            attrs: { min: 0.1, max: 3.0, step: 0.1 },
            tooltip: "Higher value requires faster movement to trigger the gesture."
        },

        // 4. 手势行为设置 (甩动距离)
        {
            id: "NodeAligner.FlickDistance",
            name: "Flick Distance",
            type: "slider",
            defaultValue: 80,
            category: ["AlignLayout", "NodeAligner", "Flick Distance"],
            attrs: { min: 20, max: 200, step: 5 },
            tooltip: "The pixel distance the mouse must move to start a gesture."
        },

        // 3. 菜单外观设置
        {
            id: "NodeAligner.Radius",
            name: "Menu Radius",
            type: "slider",
            defaultValue: 140,
            category: ["AlignLayout", "NodeAligner", "Menu Radius"],
            attrs: { min: 80, max: 300, step: 10 },
            tooltip: "The size (radius) of the radial menu."
        },

        // 2. 快捷键设置 (文本输入)
        {
            id: "NodeAligner.Shortcut",
            name: "Shortcut",
            type: "text",
            defaultValue: "Alt+A",
            category: ["AlignLayout", "NodeAligner", "Shortcut"],
            tooltip: "Key combination to trigger the menu (e.g., Alt+A, Ctrl+Q).",
            attrs: { placeholder: "e.g., Alt+A" }
        },

        // 1. 总开关
        {
            id: "NodeAligner.Enabled",
            name: "Enable Node Aligner",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "NodeAligner", "Enable Feature"],
            tooltip: "Enable or disable the node aligner feature."
        }
    ]
});