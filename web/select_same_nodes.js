import { app } from "../../scripts/app.js";

/**
 * 插件: 选择相同节点 - 逻辑模块
 * 负责监听快捷键并执行节点选择操作
 */
app.registerExtension({
    name: "Comfy.AlignLayout.SelectSame.Logic",
    async setup() {
        // 监听全局键盘事件
        window.addEventListener("keydown", (e) => {
            // 从设置面板读取实时配置
            const isEnabled = app.ui.settings.getSettingValue("AlignLayout.SelectSame.Enabled", true);
            const shortcutSetting = app.ui.settings.getSettingValue("AlignLayout.SelectSame.Shortcut", "Shift+A");

            if (!isEnabled) return;

            // 过滤输入框，避免打字冲突
            if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

            // 匹配快捷键
            if (matchShortcut(e, shortcutSetting)) {
                e.preventDefault();
                e.stopPropagation();
                selectSameNodes();
            }
        });

        /**
         * 辅助函数：解析设置中的快捷键字符串并与当前事件对比
         */
        function matchShortcut(event, shortcutStr) {
            if (!shortcutStr) return false;
            const parts = shortcutStr.split("+").map(s => s.trim().toLowerCase());
            
            const hasCtrl = parts.includes("ctrl");
            const hasShift = parts.includes("shift");
            const hasAlt = parts.includes("alt");
            const hasMeta = parts.includes("meta") || parts.includes("command");
            
            // 提取主按键 (例如 'a' 或 's')
            const keyPart = parts.filter(p => !["ctrl", "shift", "alt", "meta", "command"].includes(p))[0];
            if (!keyPart) return false;

            return (
                event.ctrlKey === hasCtrl &&
                event.shiftKey === hasShift &&
                event.altKey === hasAlt &&
                event.metaKey === hasMeta &&
                event.code.toLowerCase() === `key${keyPart}`
            );
        }

        /**
         * 核心逻辑：选中所有与当前选中节点类型相同的节点
         */
        function selectSameNodes() {
            const canvas = app.canvas;
            // [修复] 关键修改：使用 app.canvas.graph 而不是 app.graph
            // app.canvas.graph 始终指向当前正在编辑的图层（主工作流或子图）
            const graph = app.canvas.graph;
            
            // 获取用户当前选中的节点实例
            const selectedNodes = Object.values(canvas.selected_nodes);
            if (selectedNodes.length === 0) return;

            // 提取所有选中节点的类型标识符 (type/注册名)
            const targetTypes = new Set(selectedNodes.map(n => n.type));

            // 获取当前图中所有节点并进行遍历匹配
            // graph._nodes 此时会正确指向子图的节点列表
            const allNodes = graph._nodes;
            if (!allNodes) return;

            let count = 0;
            for (const node of allNodes) {
                // 如果类型在目标集合中，则选中它
                if (targetTypes.has(node.type)) {
                    // 第二个参数为 true 表示追加选择 (Add to selection)
                    canvas.selectNode(node, true);
                    count++;
                }
            }

            if (count > 0) {
                console.log(`[AlignLayout] 已基于类型选中 ${count} 个节点。`);
            }
        }
    }
});