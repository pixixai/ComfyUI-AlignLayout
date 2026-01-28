import { app } from "../../scripts/app.js";

/**
 * 插件: 替换节点 - 逻辑模块
 * 交互模式：选中节点 -> Shift+R 进入待替换状态 -> 添加任意新节点 -> 自动执行替换
 * * 修改记录：
 * - 修复了多选状态下搜索框可能飞出屏幕的问题。
 * - 修复了搜索框位置不跟随鼠标的问题。
 * - 修复了搜索框输入不稳定（自动关闭）的问题。
 */
app.registerExtension({
    name: "Comfy.AlignLayout.ReplaceNode.Logic",
    
    // 状态管理
    pendingReplaceNodeIds: [],
    isProcessing: false, // 防止死循环的锁
    lastMousePos: { x: 0, y: 0 }, // 实时记录鼠标屏幕坐标

    async setup() {
        const self = this;

        // 0. 全局追踪鼠标位置 (解决快捷键触发时无法获取鼠标坐标的问题)
        window.addEventListener("mousemove", (e) => {
            self.lastMousePos.x = e.clientX;
            self.lastMousePos.y = e.clientY;
        });

        // 1. 监听快捷键
        window.addEventListener("keydown", (e) => {
            const isEnabled = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.Enabled", true);
            const shortcutSetting = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.Shortcut", "Shift+R");

            if (!isEnabled) return;
            if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
            if (document.querySelector(".litegraph-searchbox")) return;

            if (matchShortcut(e, shortcutSetting)) {
                e.preventDefault();
                e.stopPropagation();
                toggleReplaceMode();
            }
        });

        // 2. 监听节点添加事件
        const originalOnNodeAdded = app.graph.onNodeAdded;
        app.graph.onNodeAdded = function(node) {
            if (originalOnNodeAdded) {
                originalOnNodeAdded.call(app.graph, node);
            }

            if (self.isProcessing) return;

            if (self.pendingReplaceNodeIds.length > 0) {
                if (self.pendingReplaceNodeIds.includes(node.id)) return;

                console.log("[ReplaceNode] 检测到新节点添加，执行批量替换...");
                
                handleBatchReplace(node);
                exitReplaceMode();
            }
        };

        function matchShortcut(event, shortcutStr) {
            if (!shortcutStr) return false;
            const parts = shortcutStr.split("+").map(s => s.trim().toLowerCase());
            const keyPart = parts.filter(p => !["ctrl", "shift", "alt", "meta", "command"].includes(p))[0];
            if (!keyPart) return false;

            return (
                event.ctrlKey === parts.includes("ctrl") &&
                event.shiftKey === parts.includes("shift") &&
                event.altKey === parts.includes("alt") &&
                event.metaKey === (parts.includes("meta") || parts.includes("command")) &&
                event.code.toLowerCase() === `key${keyPart}`
            );
        }

        function toggleReplaceMode() {
            if (self.pendingReplaceNodeIds.length > 0) {
                exitReplaceMode();
                return;
            }

            const canvas = app.canvas;
            const selectedNodes = Object.values(canvas.selected_nodes);
            
            if (selectedNodes.length === 0) {
                alert("请先选中要替换的节点");
                return;
            }

            const firstType = selectedNodes[0].type;
            const isSameType = selectedNodes.every(n => n.type === firstType);

            if (!isSameType) {
                alert("批量替换仅支持选中相同类型的节点。请重新选择。");
                return;
            }

            enterReplaceMode(selectedNodes);
        }

        // 辅助：Hex 转 RGBA
        function hexToRgba(input, alpha) {
            if (!input) return input;
            
            let hex = input.toString().trim();
            if (hex.startsWith("0x")) hex = hex.slice(2);
            else if (hex.startsWith("#")) hex = hex.slice(1);

            if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) return input;

            if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');

            const bigint = parseInt(hex, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;

            return `rgba(${r},${g},${b},${alpha})`;
        }

        function normalizeCssColor(input) {
            if (!input) return input;
            let color = input.toString().trim();
            if (color.startsWith("0x")) return "#" + color.slice(2);
            if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(color)) return "#" + color;
            return color;
        }

        function enterReplaceMode(nodes) {
            self.pendingReplaceNodeIds = nodes.map(n => n.id);
            
            let borderColorSetting = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.BorderColor", "#FFFF00");
            const opacitySetting = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.Opacity", 0.15);
            const glowStrengthSetting = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.GlowStrength", 15);
            const strokeWidthSetting = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.StrokeWidth", 3);

            borderColorSetting = normalizeCssColor(borderColorSetting);

            for (const node of nodes) {
                if (node.hasOwnProperty('onDrawForeground')) {
                    node._original_onDrawForeground = node.onDrawForeground;
                }

                node.onDrawForeground = function(ctx) {
                    if (node._original_onDrawForeground) {
                        node._original_onDrawForeground.call(this, ctx);
                    }
                    
                    ctx.save();
                    
                    const borderColor = borderColorSetting;
                    const glowColor = borderColorSetting;
                    const fillColor = hexToRgba(borderColorSetting, opacitySetting);

                    ctx.shadowColor = glowColor; 
                    ctx.shadowBlur = glowStrengthSetting;
                    ctx.strokeStyle = borderColor; 
                    ctx.lineWidth = strokeWidthSetting;
                    ctx.fillStyle = fillColor;

                    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT || 30;
                    const padding = 5;

                    let visualWidth = this.size[0];
                    let visualHeight = this.size[1];
                    let bodyHeight = visualHeight;

                    if (this.flags.collapsed) {
                        bodyHeight = 0; 
                        const oldFont = ctx.font;
                        ctx.font = "bold 14px Arial"; 
                        const titleWidth = ctx.measureText(this.title).width;
                        ctx.font = oldFont; 
                        visualWidth = titleWidth + 50; 
                    }

                    const startY = -titleHeight - padding;
                    const totalHeight = titleHeight + bodyHeight + padding * 2;
                    const startX = -padding;
                    const totalWidth = visualWidth + padding * 2;
                    const r = 10; 
                    
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(startX, startY, totalWidth, totalHeight, r);
                        ctx.fill();   
                        ctx.stroke(); 
                    } else {
                        ctx.fillRect(startX, startY, totalWidth, totalHeight);
                        ctx.strokeRect(startX, startY, totalWidth, totalHeight);
                    }
                    
                    ctx.restore();
                };
                
                node.setDirtyCanvas(true, true);
            }
            app.canvas.setDirty(true, true);

            // --- 菜单触发逻辑 ---
            const triggerMode = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.MenuTrigger", "SearchBox");
            
            if (triggerMode === "SearchBox") {
                // 【修复逻辑】始终使用当前鼠标位置 (Screen Coordinates)
                // 这样无论选中了哪个节点，搜索框都会出现在鼠标手边
                
                const screenX = self.lastMousePos.x;
                const screenY = self.lastMousePos.y;

                const graphCanvas = app.canvas;
                const ds = graphCanvas.ds; // transform: { scale, offset }
                const canvasRect = graphCanvas.canvas.getBoundingClientRect();

                // 屏幕坐标 -> 逻辑坐标
                // 确保新生成的节点出现在鼠标位置
                // 公式: Logical = (Screen - Rect - Offset*Scale) / Scale
                // 即: (screenX - canvasRect.left) / ds.scale - ds.offset[0]
                
                const canvasX = (screenX - canvasRect.left) / ds.scale - ds.offset[0];
                const canvasY = (screenY - canvasRect.top) / ds.scale - ds.offset[1];

                // 构造模拟事件对象
                // 注意：这里将 type 改为 'contextmenu' 或 'click'，避免使用 'keydown'
                // 因为传递 'keydown' 可能会让搜索框误以为还在输入状态，导致不稳定
                const dummyEvent = { 
                    type: "contextmenu", 
                    clientX: screenX,
                    clientY: screenY,
                    canvasX: canvasX,
                    canvasY: canvasY,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };

                // 调用 ComfyUI 标准搜索框
                app.canvas.showSearchBox(dummyEvent);
            } 
            else if (triggerMode === "AddNodeMenu") {
                if (typeof window.alignLayout_openAddNodeMenu === "function") {
                    window.alignLayout_openAddNodeMenu();
                } else {
                    console.warn("[ReplaceNode] alignLayout_openAddNodeMenu not found.");
                }
            }
            else if (triggerMode === "QuickNodeMenu") {
                if (typeof window.alignLayout_openQuickNodeMenu === "function") {
                    window.alignLayout_openQuickNodeMenu();
                } else {
                    console.warn("[ReplaceNode] alignLayout_openQuickNodeMenu not found.");
                }
            }
        }

        function exitReplaceMode() {
            if (self.pendingReplaceNodeIds.length === 0) return;

            const graph = app.graph;
            for (const id of self.pendingReplaceNodeIds) {
                const node = graph.getNodeById(id);
                if (!node) continue;

                if (node._original_onDrawForeground !== undefined) {
                    node.onDrawForeground = node._original_onDrawForeground;
                    delete node._original_onDrawForeground;
                } else {
                    delete node.onDrawForeground;
                }
                
                node.setDirtyCanvas(true, true);
            }

            self.pendingReplaceNodeIds = [];
            app.canvas.setDirty(true, true);
        }

        function handleBatchReplace(templateNode) {
            const graph = app.graph;
            self.isProcessing = true;
            graph.beforeChange();

            try {
                app.canvas.deselectAllNodes();
                const newNodes = [];
                const idsToReplace = [...self.pendingReplaceNodeIds];
                
                const firstOldNode = graph.getNodeById(idsToReplace[0]);
                if (firstOldNode) {
                    doReplaceSingle(firstOldNode, templateNode);
                    newNodes.push(templateNode);
                }

                for (let i = 1; i < idsToReplace.length; i++) {
                    const oldNode = graph.getNodeById(idsToReplace[i]);
                    if (!oldNode) continue;

                    const newNode = LiteGraph.createNode(templateNode.type);
                    if (newNode) {
                        newNode.pos = [oldNode.pos[0], oldNode.pos[1]]; 
                        graph.add(newNode);
                        doReplaceSingle(oldNode, newNode);
                        newNodes.push(newNode);
                    }
                }

                if (newNodes.length > 0) {
                    app.canvas.selectNodes(newNodes);
                }

            } catch (error) {
                console.error("[ReplaceNode] 批量替换出错:", error);
            } finally {
                graph.afterChange();
                app.canvas.setDirty(true, true);
                self.isProcessing = false;
            }
        }

        function doReplaceSingle(oldNode, newNode) {
            const graph = app.graph;
            newNode.pos = [...oldNode.pos];
            
            // 复制 Widget 值
            if (oldNode.widgets && newNode.widgets) {
                for (const ow of oldNode.widgets) {
                    const nw = newNode.widgets.find(w => w.name === ow.name && w.type === ow.type);
                    if (nw) {
                        nw.value = ow.value;
                        if (nw.callback) {
                            nw.callback(nw.value, app.canvas, newNode, newNode.pos, null);
                        }
                    }
                }
            }

            // 智能处理：JsonCombined 类的节点
            const mergeKeysWidget = newNode.widgets?.find(w => w.name === "merge_keys");
            if (mergeKeysWidget && oldNode.inputs) {
                const connectedInputNames = [];
                for(const input of oldNode.inputs) {
                    if (input.link !== null) {
                        connectedInputNames.push(input.name);
                    }
                }
                
                if (connectedInputNames.length > 0) {
                    const newText = connectedInputNames.join("\n");
                    if (mergeKeysWidget.value !== newText) {
                        mergeKeysWidget.value = newText;
                        if (mergeKeysWidget.callback) {
                            mergeKeysWidget.callback(mergeKeysWidget.value, app.canvas, newNode, newNode.pos, null);
                        }
                        if (newNode.onResize) newNode.onResize(newNode.size);
                    }
                }
            }

            // 处理输入连线
            if (oldNode.inputs) {
                for (let i = 0; i < oldNode.inputs.length; i++) {
                    const oldInput = oldNode.inputs[i];
                    if (!oldInput.link) continue;
                    const linkInfo = graph.links[oldInput.link];
                    if (!linkInfo) continue;

                    const originNode = graph.getNodeById(linkInfo.origin_id);
                    // 传入当前索引 i，作为兜底
                    const newSlotIndex = findBestInputSlot(newNode, oldInput, i);
                    
                    // 自动扩展槽位逻辑 (PixNodes 风格)
                    if (newSlotIndex >= newNode.inputs.length) {
                        const lastInput = newNode.inputs[newNode.inputs.length - 1];
                        if (lastInput) {
                            const nameMatch = lastInput.name.match(/^(.*_)(\d+)$/);
                            if (nameMatch) {
                                const prefix = nameMatch[1];
                                while (newNode.inputs.length <= newSlotIndex) {
                                    const nextId = newNode.inputs.length + 1;
                                    newNode.addInput(`${prefix}${nextId}`, lastInput.type);
                                }
                            }
                        }
                    }

                    if (newSlotIndex !== -1 && newSlotIndex < newNode.inputs.length) {
                        originNode.connect(linkInfo.origin_slot, newNode, newSlotIndex);
                    }
                }
            }

            // 处理输出连线
            if (oldNode.outputs) {
                for (let i = 0; i < oldNode.outputs.length; i++) {
                    const oldOutput = oldNode.outputs[i];
                    if (!oldOutput.links || oldOutput.links.length === 0) continue;

                    const newSlotIndex = findBestOutputSlot(newNode, oldOutput, i);
                    
                    if (newSlotIndex !== -1 && newSlotIndex < newNode.outputs.length) {
                        const linksToMigrate = [...oldOutput.links];
                        for (const linkId of linksToMigrate) {
                            const linkInfo = graph.links[linkId];
                            if (!linkInfo) continue;
                            const targetNode = graph.getNodeById(linkInfo.target_id);
                            newNode.connect(newSlotIndex, targetNode, linkInfo.target_slot);
                        }
                    }
                }
            }

            graph.remove(oldNode);
        }

        /**
         * 寻找最佳输入端口
         * 优先级:
         * 1. Name & Type 完全匹配
         * 2. Name 匹配
         * 3. Type 匹配 (且唯一)
         * 4. 顺序兜底 (Force Connect 或 类型兼容)
         */
        function findBestInputSlot(node, oldSlot, oldIndex) {
            if (!node.inputs) return -1;
            
            // 1. 完全匹配
            let idx = node.inputs.findIndex(s => s.name === oldSlot.name && s.type === oldSlot.type);
            if (idx !== -1) return idx;

            // 2. 名称匹配
            idx = node.inputs.findIndex(s => s.name === oldSlot.name);
            if (idx !== -1) return idx;

            // 3. 类型匹配 (排除 Any)
            const specificMatches = node.inputs.map((s, i) => ({s, i})).filter(item => {
                if (oldSlot.type === "*" || oldSlot.type === "Any") return false;
                if (item.s.type === "*" || item.s.type === "Any") return false;
                return item.s.type === oldSlot.type;
            });
            if (specificMatches.length === 1) return specificMatches[0].i;

            // 4. 兜底逻辑
            const targetSlot = (oldIndex < node.inputs.length) ? node.inputs[oldIndex] : null;
            const forceConnect = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.ForceConnect", true);

            if (forceConnect) {
                return oldIndex;
            }

            if (targetSlot) {
                const isTypeCompatible = (
                    oldSlot.type === "*" || oldSlot.type === "Any" ||
                    targetSlot.type === "*" || targetSlot.type === "Any" ||
                    oldSlot.type === targetSlot.type
                );
                if (isTypeCompatible) return oldIndex;
            } else {
                return -1;
            }

            return -1;
        }

        function findBestOutputSlot(node, oldSlot, oldIndex) {
            if (!node.outputs) return -1;
            
            let idx = node.outputs.findIndex(s => s.name === oldSlot.name && s.type === oldSlot.type);
            if (idx !== -1) return idx;
            
            idx = node.outputs.findIndex(s => s.name === oldSlot.name);
            if (idx !== -1) return idx;

            const specificMatches = node.outputs.map((s, i) => ({s, i})).filter(item => {
                if (oldSlot.type === "*" || oldSlot.type === "Any") return false;
                if (item.s.type === "*" || item.s.type === "Any") return false;
                return item.s.type === oldSlot.type;
            });
            if (specificMatches.length === 1) return specificMatches[0].i;

            // 4. 兜底逻辑
            if (oldIndex < node.outputs.length) {
                const targetSlot = node.outputs[oldIndex];
                const forceConnect = app.ui.settings.getSettingValue("AlignLayout.ReplaceNode.ForceConnect", true);

                if (forceConnect) return oldIndex;

                const isTypeCompatible = (
                    oldSlot.type === "*" || oldSlot.type === "Any" ||
                    targetSlot.type === "*" || targetSlot.type === "Any" ||
                    oldSlot.type === targetSlot.type
                );
                if (isTypeCompatible) return oldIndex;
            }

            return -1;
        }
    }
});