import { app } from "../../scripts/app.js";

// =========================================================
// 插件: Quick Node Menu (快捷节点菜单/收藏菜单) 设置
// =========================================================
app.registerExtension({
    name: "Comfy.QuickNodeMenu.Settings",
    settings: [
        // 9. 记住上次打开的分类 (代码倒序 - 界面显示在底部)
        {
            id: "QuickNodeMenu.RememberLast",
            name: "Remember Last Category",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "QuickNodeMenu", "Remember Last Category"],
            tooltip: "Remember the last opened folder when reopening the menu."
        },

        // 8. 悬停高亮颜色 (紫色)
        {
            id: "QuickNodeMenu.ColorHover",
            name: "Highlight Color (Hover)",
            type: "text",
            defaultValue: "#6c5ce7",
            category: ["AlignLayout", "QuickNodeMenu", "Highlight Color (Hover)"],
            tooltip: "Color for hovered items. Supports: #RRGGBB, 0xRRGGBB, RRGGBB.",
            attrs: { placeholder: "#6c5ce7" }
        },

        // 7. 毛玻璃效果开关
        {
            id: "QuickNodeMenu.EnableBlur",
            name: "Enable Blur Effect",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "QuickNodeMenu", "Enable Blur Effect"],
            tooltip: "Enable frosted glass background effect (disable for performance)."
        },

        // 6. 透明度
        {
            id: "QuickNodeMenu.Opacity",
            name: "Menu Opacity",
            type: "slider",
            defaultValue: 0.98,
            category: ["AlignLayout", "QuickNodeMenu", "Menu Opacity"],
            attrs: { min: 0.1, max: 1.0, step: 0.01 },
            tooltip: "Background opacity of the menu."
        },

        // 5. 菜单宽度限制
        {
            id: "QuickNodeMenu.MaxWidth",
            name: "Menu Max Width",
            type: "slider",
            defaultValue: 400,
            category: ["AlignLayout", "QuickNodeMenu", "Menu Max Width"],
            attrs: { min: 200, max: 800, step: 10 },
            tooltip: "Maximum width of the menu in pixels."
        },

        // 4. 菜单字体大小
        {
            id: "QuickNodeMenu.FontSize",
            name: "Menu Font Size",
            type: "number",
            defaultValue: 12.5,
            category: ["AlignLayout", "QuickNodeMenu", "Menu Font Size"],
            attrs: { min: 10, max: 24, step: 0.5, maxFractionDigits: 1 },
            tooltip: "Font size of the menu items (px)."
        },

        // 3. 子菜单延迟
        {
            id: "QuickNodeMenu.HoverDelay",
            name: "Submenu Delay",
            type: "slider",
            defaultValue: 40,
            category: ["AlignLayout", "QuickNodeMenu", "Submenu Delay"],
            attrs: { min: 0, max: 500, step: 10 },
            tooltip: "Delay in milliseconds before opening a submenu on hover."
        },

        // 2. 快捷键
        {
            id: "QuickNodeMenu.Shortcut",
            name: "Quick Node Menu Shortcut",
            type: "text",
            defaultValue: "Q",
            category: ["AlignLayout", "QuickNodeMenu", "Quick Node Menu Shortcut"],
            tooltip: "Key combination to open the menu (e.g., Q, Alt+Q).",
            attrs: { placeholder: "e.g., Q" }
        },

        // 1. 启用快捷节点菜单 (开关) (代码倒序 - 界面显示在顶部)
        {
            id: "QuickNodeMenu.Enabled",
            name: "Enable Quick Node Menu",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "QuickNodeMenu", "Enable Quick Node Menu"],
            tooltip: "Enable or disable the custom quick node menu (favorites)."
        }
    ]
});