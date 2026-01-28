import { app } from "../../scripts/app.js";

// =========================================================
// 辅助函数：获取设置值
// =========================================================
function getSetting(id, defaultValue) {
    const value = app.extensionManager.setting.get(id);
    return value !== undefined ? value : defaultValue;
}

// =========================================================
// 插件逻辑
// =========================================================

app.registerExtension({
    name: "Comfy.FastLink",
    
    init() {
        this.commandState = {
            lastCmd: null,
            count: 0,
            lastTime: 0,
            lastSelection: ""
        };

        window.addEventListener("keydown", (e) => {
            // 1. 动态读取配置
            const enabled = getSetting("FastLink.Enabled", true);
            if (!enabled) return;

            const shortcutConfig = getSetting("FastLink.Shortcut", "F");
            const triggerKey = (shortcutConfig && shortcutConfig.length > 0) 
                ? shortcutConfig.charAt(0).toUpperCase() 
                : "F";
            
            if (e.key.toUpperCase() === triggerKey) {
                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
                if (e.metaKey) return; // Mac Command键

                let cmdType = null;
                
                // 优先级：修饰键越多越优先判断
                if (e.ctrlKey && e.shiftKey && e.altKey) {
                    cmdType = "CMD_CLEAR_INTERNAL"; // 新增：清除内部连线
                } else if (e.altKey) {
                    cmdType = "ALT_KEY"; // 链式
                } else if (e.ctrlKey && e.shiftKey) {
                    cmdType = "CTRL_SHIFT_KEY"; // 强制一对多
                } else if (e.ctrlKey) {
                    cmdType = "CTRL_KEY"; // 强制多对一
                } else if (e.shiftKey) {
                    cmdType = "SHIFT_KEY"; // 一对多
                } else {
                    cmdType = "KEY"; // 多对一
                }

                if (cmdType) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.executeCommand(cmdType);
                }
            }
        });
    },

    executeCommand(cmdType) {
        const currentSelectedNodes = app.canvas.selected_nodes || {};
        const currentIds = Object.keys(currentSelectedNodes).sort().join(",");
        const now = Date.now();
        
        // 读取超时设置
        const resetTimeout = getSetting("FastLink.ResetTimeout", 2000);

        if (currentIds !== this.commandState.lastSelection || 
            cmdType !== this.commandState.lastCmd || 
            (now - this.commandState.lastTime > resetTimeout)) {
            
            this.commandState.count = 0;
            this.commandState.lastSelection = currentIds;
            this.commandState.lastCmd = cmdType;
        } else {
            this.commandState.count++;
        }

        this.commandState.lastTime = now;

        const offset = this.commandState.count;

        // 【关键修复】：在轮询模式(offset > 0)下，必须先断开选区内 Source->Target 的旧连线
        // 否则非强制模式会因为端口被占用而跳过连接，导致无法“切换”接口。

        switch (cmdType) {
            case "KEY": 
                // 多对一 (F) - 切换终点接口
                if (offset > 0) {
                    const nodes = this.getSortedSelection();
                    if (nodes.length >= 2) {
                        const target = nodes[nodes.length - 1];
                        const sources = nodes.slice(0, nodes.length - 1);
                        this.disconnectLinksBetween(sources, [target]);
                    }
                }
                this.connectManyToOne({ offset: offset, cycleTargetSlots: offset > 0 });
                break;
                
            case "SHIFT_KEY": 
                // 一对多 (Shift+F) - 切换起点接口
                if (offset > 0) {
                    const nodes = this.getSortedSelectionStrict();
                    if (nodes.length >= 2) {
                        const source = nodes[0];
                        const targets = nodes.slice(1);
                        this.disconnectLinksBetween([source], targets);
                    }
                }
                this.connectOneToMany({ offset: offset, cycleSourceSlots: offset > 0 });
                break;

            case "CTRL_KEY": 
                // 强制多对一 (Ctrl+F) - 切换源节点
                if (offset > 0) {
                    const nodes = this.getSortedSelection();
                    if (nodes.length >= 2) {
                        const target = nodes[nodes.length - 1];
                        const sources = nodes.slice(0, nodes.length - 1);
                        this.disconnectLinksBetween(sources, [target]);
                    }
                }
                this.connectManyToOne({ offset: offset, force: true, cycleSourceNodes: offset > 0 });
                break;

            case "CTRL_SHIFT_KEY": 
                // 强制一对多 (Ctrl+Shift+F) - 切换目标节点
                if (offset > 0) {
                    const nodes = this.getSortedSelectionStrict();
                    if (nodes.length >= 2) {
                        const source = nodes[0];
                        const targets = nodes.slice(1);
                        this.disconnectLinksBetween([source], targets);
                    }
                }
                this.connectOneToMany({ offset: offset, force: true, cycleTargetNodes: offset > 0 });
                break;

            case "ALT_KEY": 
                this.connectDaisyChain();
                break;

            case "CMD_CLEAR_INTERNAL":
                this.clearSelectedInternalLinks();
                break;
        }
    },

    // 辅助：获取排序后的节点 (Visual Column)
    getSortedSelection() {
        if (!app.canvas.selected_nodes) return [];
        return this.sortNodesByVisualColumns(Object.values(app.canvas.selected_nodes));
    },

    // 辅助：获取排序后的节点 (Strict Left)
    getSortedSelectionStrict() {
        if (!app.canvas.selected_nodes) return [];
        return this.sortNodesByStrictLeft(Object.values(app.canvas.selected_nodes));
    },

    // 精准断开函数：只断开指定 sources 到指定 targets 之间的线
    disconnectLinksBetween(sources, targets) {
        if (!sources.length || !targets.length) return;
        
        const sourceIds = new Set(sources.map(n => n.id));
        let changed = false;

        // 遍历所有目标节点的输入
        for (const target of targets) {
            if (!target.inputs) continue;
            for (let i = 0; i < target.inputs.length; i++) {
                const linkId = target.inputs[i].link;
                if (linkId !== null) {
                    const link = app.graph.links[linkId];
                    // 如果这条线的源头在我们的 source 列表中 -> 断开
                    if (link && sourceIds.has(link.origin_id)) {
                        target.disconnectInput(i);
                        changed = true;
                    }
                }
            }
        }
        if (changed) app.graph.setDirtyCanvas(true, true);
    },

    // 原 disconnectInternalLinks，现在只用于 Ctrl+Shift+Alt+F
    clearSelectedInternalLinks() {
        const selectedNodes = Object.values(app.canvas.selected_nodes || {});
        if (selectedNodes.length < 2) return;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        let changed = false;

        for (const node of selectedNodes) {
            if (!node.inputs) continue;
            for (let i = 0; i < node.inputs.length; i++) {
                const linkId = node.inputs[i].link;
                if (linkId !== null) {
                    const link = app.graph.links[linkId];
                    if (link && selectedNodeIds.has(link.origin_id)) {
                        node.disconnectInput(i);
                        changed = true;
                    }
                }
            }
        }
        if (changed) app.graph.setDirtyCanvas(true, true);
    },

    // --- 排序算法 1: 视觉列排序 ---
    sortNodesByVisualColumns(nodes) {
        const verticalThreshold = getSetting("FastLink.VerticalThreshold", 0.8);

        return nodes.sort((a, b) => {
            const aLeft = a.pos[0], aRight = a.pos[0] + a.size[0];
            const bLeft = b.pos[0], bRight = b.pos[0] + b.size[0];

            const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
            const minWidth = Math.min(a.size[0], b.size[0]);

            const isVerticalStack = overlap > (minWidth * verticalThreshold);

            if (isVerticalStack) {
                if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
                return a.id - b.id;
            } else {
                return a.pos[0] - b.pos[0];
            }
        });
    },

    // --- 排序算法 2: 严格左上排序 ---
    sortNodesByStrictLeft(nodes) {
        return nodes.sort((a, b) => {
            if (a.pos[0] !== b.pos[0]) return a.pos[0] - b.pos[0];
            if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
            return a.id - b.id;
        });
    },

    // 核心连接逻辑
    connectSourcesToTarget(sources, targetNode, options = {}) {
        if (!targetNode.inputs) return false;

        const { force = false, offset = 0, cycleTargetSlots = false, cycleSourceSlots = false } = options;
        let connectionMade = false;
        const usedSourceOutputs = new Set(); 
        const inputCount = targetNode.inputs.length;
        const matchStrategy = getSetting("FastLink.MatchStrategy", "name_type");

        for (let k = 0; k < inputCount; k++) {
            const i = cycleTargetSlots ? (k + offset) % inputCount : k;
            const input = targetNode.inputs[i];
            
            // 如果是非强制模式，且接口已有连线，坚决跳过，保护现有连接
            if (input.link && !force) continue;

            let bestMatch = null;
            let bestMatchScore = 0;

            for (const sourceNode of sources) {
                if (!sourceNode.outputs) continue;
                const outputCount = sourceNode.outputs.length;

                for (let m = 0; m < outputCount; m++) {
                    const j = cycleSourceSlots ? (m + offset) % outputCount : m;
                    const output = sourceNode.outputs[j];
                    
                    if (!cycleSourceSlots && usedSourceOutputs.has(`${sourceNode.id}_${j}`)) continue;
                    
                    // 强制模式检查：如果已经连接的就是这个源，跳过（避免重复断开重连）
                    if (input.link) {
                        const link = app.graph.links[input.link];
                        if (link && link.origin_id === sourceNode.id && link.origin_slot === j) continue;
                    }

                    // --- 匹配逻辑 ---
                    let currentScore = 0;
                    const inputType = input.type;
                    const outputType = output.type;
                    const isInputWildcard = inputType === "*" || inputType === "REROUTE";
                    const isOutputWildcard = outputType === "*" || outputType === "REROUTE";
                    const isCompatible = (inputType === outputType) || isInputWildcard || isOutputWildcard;

                    if (!isCompatible) continue;

                    if (isInputWildcard || isOutputWildcard) {
                        currentScore = 1;
                    } else if (matchStrategy === "type_only") {
                        currentScore = 3;
                    } else {
                        const inputName = (input.name || "").toUpperCase();
                        const outputName = (output.name || "").toUpperCase();
                        if (inputName === outputName) {
                            currentScore = 3;
                        } else {
                            currentScore = 2;
                        }
                    }

                    if (currentScore > bestMatchScore) {
                        bestMatchScore = currentScore;
                        bestMatch = { sourceNode, outputIndex: j };
                    }
                }
            }

            if (bestMatch) {
                // 只有在 force=true 时，且 input.link 存在时，才断开
                if (input.link && force) {
                    targetNode.disconnectInput(i);
                }
                bestMatch.sourceNode.connect(bestMatch.outputIndex, targetNode, i);
                usedSourceOutputs.add(`${bestMatch.sourceNode.id}_${bestMatch.outputIndex}`);
                connectionMade = true;
            }
        }
        return connectionMade;
    },

    connectManyToOne(options = {}) {
        const nodes = this.getSortedSelection();
        if (nodes.length < 2) return;

        const targetNode = nodes.pop(); 
        let sourceNodes = nodes;        

        if (options.cycleSourceNodes) {
            const idx = options.offset % sourceNodes.length;
            sourceNodes = [sourceNodes[idx]];
        }
        if (this.connectSourcesToTarget(sourceNodes, targetNode, options)) {
            app.graph.setDirtyCanvas(true, true);
        }
    },

    connectOneToMany(options = {}) {
        const nodes = this.getSortedSelectionStrict();
        if (nodes.length < 2) return;

        const sourceNode = nodes.shift(); 
        let targetNodes = nodes;          

        if (options.cycleTargetNodes) {
            const idx = options.offset % targetNodes.length;
            targetNodes = [targetNodes[idx]];
        }
        let changed = false;
        for (const targetNode of targetNodes) {
            if (this.connectSourcesToTarget([sourceNode], targetNode, options)) {
                changed = true;
            }
        }
        if (changed) app.graph.setDirtyCanvas(true, true);
    },

    connectDaisyChain() {
        const nodes = this.getSortedSelection();
        if (nodes.length < 2) return;

        let changed = false;
        let currentSource = nodes[0];

        for (let i = 1; i < nodes.length; i++) {
            const target = nodes[i];
            // 链式连接通常是非强制的，避免破坏中间复杂的布线
            if (this.connectSourcesToTarget([currentSource], target, { force: false })) {
                currentSource = target;
                changed = true;
            } 
        }
        if (changed) app.graph.setDirtyCanvas(true, true);
    }
});