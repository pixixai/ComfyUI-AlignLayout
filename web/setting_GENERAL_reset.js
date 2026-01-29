import { app } from "../../scripts/app.js";

// =========================================================
// 插件: AlignLayout 全局主恢复按钮 (简化版)
// =========================================================

app.registerExtension({
    name: "Comfy.AlignLayout.MasterReset",
    settings: [
        {
            // 使用分组名作为 ID 前缀，既保证唯一性又直观
            id: "A-General.MasterResetAll",
            name: "Restore All Defaults",
            type: "boolean",
            defaultValue: false,
            // 归类到 A-General 分组，排序最靠前
            category: ["AlignLayout", "A-General", "Restore All Defaults"], 
            tooltip: "⚠️ ULTRA WARNING: Click to RESET ALL settings across ALL AlignLayout plugins to their original factory defaults.",
            onChange: async (newVal) => {
                if (newVal === true) {
                    const confirmed = confirm("Are you absolutely sure you want to reset ALL AlignLayout plugins to their default settings? This cannot be undone.");

                    if (confirmed) {
                        // --- 动态扫描逻辑 ---
                        app.extensions.forEach(ext => {
                            if (ext.settings && Array.isArray(ext.settings)) {
                                ext.settings.forEach(setting => {
                                    // 只要分类是 AlignLayout，就执行重置
                                    if (setting.category && setting.category[0] === "AlignLayout") {
                                        
                                        // 排除逻辑：跳过所有 ID 包含 ResetAll 的子插件重置按钮，以及本全局重置按钮
                                        if (setting.id.endsWith(".ResetAll") || setting.id === "A-General.MasterResetAll") {
                                            return;
                                        }

                                        try {
                                            if (setting.id && setting.defaultValue !== undefined) {
                                                app.extensionManager.setting.set(setting.id, setting.defaultValue);
                                            }
                                        } catch (e) {
                                            console.error(`Failed to dynamic reset ${setting.id}`, e);
                                        }
                                    }
                                });
                            }
                        });
                    }

                    // 自动复位
                    setTimeout(() => {
                        app.extensionManager.setting.set("A-General.MasterResetAll", false);
                    }, 100);
                }
            }
        }
    ]
});