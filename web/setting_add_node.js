import { app } from "../../scripts/app.js";

// =========================================================
// 插件: Add Node Menu (添加节点菜单) 设置
// =========================================================
app.registerExtension({
    name: "Comfy.AddNodeMenu.Settings",
    settings: [
        // 12. 记住上次打开的分类 (代码倒序 - 界面显示在底部)
        {
            id: "AddNodeMenu.RememberLast",
            name: "Remember Last Category",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "AddNodeMenu", "Remember Last Category"],
            tooltip: "Remember the last opened folder when reopening the menu."
        },

        // 11. 排除列表 (过滤)
        {
            id: "AddNodeMenu.ExcludeList",
            name: "Exclude Categories/Nodes",
            type: "text",
            defaultValue: "",
            category: ["AlignLayout", "AddNodeMenu", "Exclude Categories/Nodes"],
            tooltip: "Comma-separated list of names or categories to hide (e.g. Legacy, Test).",
            attrs: { 
                placeholder: "e.g. Legacy, _test...",
                style: "width: 100%; min-width: 300px;"
            }
        },

        // 10. ComfyUI基础节点 (首选分类列表)
        {
            id: "AddNodeMenu.PrimaryCategories",
            name: "Primary Categories",
            type: "text",
            defaultValue: "utils,sampling,采样,loaders,加载器,latent,Latent,_for_testing,_用于测试,advanced,高级,mask,遮罩,image,图像,api node,工具,api,api 节点,API",
            category: ["AlignLayout", "AddNodeMenu", "Primary Categories"],
            tooltip: "Comma-separated list of categories to show at the top of the root menu.",
            attrs: { 
                placeholder: "utils, sampling, loaders...",
                style: "width: 100%; min-width: 300px;" 
            }
        },

        // 9. 收藏标记颜色
        {
            id: "AddNodeMenu.ColorMark",
            name: "Mark Color (Favorite)",
            type: "text",
            defaultValue: "#2ecc71",
            category: ["AlignLayout", "AddNodeMenu", "Mark Color (Favorite)"],
            tooltip: "Color for favorite/quick items. Supports: #RRGGBB, 0xRRGGBB, RRGGBB.",
            attrs: { placeholder: "#2ecc71" }
        },

        // 8. 悬停高亮颜色
        {
            id: "AddNodeMenu.ColorHover",
            name: "Highlight Color (Hover)",
            type: "text",
            defaultValue: "#2a60a8",
            category: ["AlignLayout", "AddNodeMenu", "Highlight Color (Hover)"],
            tooltip: "Color for hovered items. Supports: #RRGGBB, 0xRRGGBB, RRGGBB.",
            attrs: { placeholder: "#2a60a8" }
        },

        // 7. 毛玻璃效果开关
        {
            id: "AddNodeMenu.EnableBlur",
            name: "Enable Blur Effect",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "AddNodeMenu", "Enable Blur Effect"],
            tooltip: "Enable frosted glass background effect (disable for performance)."
        },

        // 6. 透明度
        {
            id: "AddNodeMenu.Opacity",
            name: "Menu Opacity",
            type: "slider",
            defaultValue: 0.98,
            category: ["AlignLayout", "AddNodeMenu", "Menu Opacity"],
            attrs: { min: 0.1, max: 1.0, step: 0.01 },
            tooltip: "Background opacity of the menu."
        },

        // 5. 菜单宽度限制
        {
            id: "AddNodeMenu.MaxWidth",
            name: "Menu Max Width",
            type: "slider",
            defaultValue: 400,
            category: ["AlignLayout", "AddNodeMenu", "Menu Max Width"],
            attrs: { min: 200, max: 800, step: 10 },
            tooltip: "Maximum width of the menu in pixels."
        },

        // 4. 菜单字体大小
        {
            id: "AddNodeMenu.FontSize",
            name: "Menu Font Size",
            type: "number",
            defaultValue: 12.5,
            category: ["AlignLayout", "AddNodeMenu", "Menu Font Size"],
            attrs: { min: 10, max: 24, step: 0.5, maxFractionDigits: 1 },
            tooltip: "Font size of the menu items (px)."
        },

        // 3. 子菜单延迟
        {
            id: "AddNodeMenu.HoverDelay",
            name: "Submenu Delay",
            type: "slider",
            defaultValue: 40,
            category: ["AlignLayout", "AddNodeMenu", "Submenu Delay"],
            attrs: { min: 0, max: 500, step: 10 },
            tooltip: "Delay in milliseconds before opening a submenu on hover."
        },

        // 2. 快捷键
        {
            id: "AddNodeMenu.Shortcut",
            name: "Add Node Menu Shortcut",
            type: "text",
            defaultValue: "A",
            category: ["AlignLayout", "AddNodeMenu", "Add Node Menu Shortcut"],
            tooltip: "Key combination to open the menu (e.g., A, Alt+A).",
            attrs: { placeholder: "e.g., A" }
        },

        // 1. 启用添加节点菜单 (开关) (代码倒序 - 界面显示在顶部)
        {
            id: "AddNodeMenu.Enabled",
            name: "Enable Add Node Menu",
            type: "boolean",
            defaultValue: true,
            category: ["AlignLayout", "AddNodeMenu", "Enable Add Node Menu"],
            tooltip: "Enable or disable the custom add node menu."
        }
    ]
});