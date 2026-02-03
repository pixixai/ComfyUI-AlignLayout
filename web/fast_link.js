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
            const enabled = getSetting("FastLink.Enabled", true);
            if (!enabled) return;

            const shortcutConfig = getSetting("FastLink.Shortcut", "F");
            const triggerKey = (shortcutConfig && shortcutConfig.length > 0) 
                ? shortcutConfig.charAt(0).toUpperCase() 
                : "F";
            
            if (e.key.toUpperCase() === triggerKey) {
                // 避免在输入框中触发
                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
                if (e.metaKey) return; 

                let cmdType = null;
                
                if (e.ctrlKey && e.shiftKey && e.altKey) {
                    cmdType = "CMD_CLEAR_INTERNAL"; 
                } else if (e.altKey) {
                    cmdType = "ALT_KEY"; 
                } else if (e.ctrlKey && e.shiftKey) {
                    cmdType = "CTRL_SHIFT_KEY"; 
                } else if (e.ctrlKey) {
                    cmdType = "CTRL_KEY"; 
                } else if (e.shiftKey) {
                    cmdType = "SHIFT_KEY"; 
                } else {
                    cmdType = "KEY"; 
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

        // 轮询模式下，先断开旧连线以便切换
        switch (cmdType) {
            case "KEY": 
                // 多对一 (F)
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
                // 一对多 (Shift+F)
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
                // 强制多对一 (Ctrl+F)
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
                // 强制一对多 (Ctrl+Shift+F)
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

    getSortedSelection() {
        if (!app.canvas.selected_nodes) return [];
        return this.sortNodesByVisualColumns(Object.values(app.canvas.selected_nodes));
    },

    getSortedSelectionStrict() {
        if (!app.canvas.selected_nodes) return [];
        return this.sortNodesByStrictLeft(Object.values(app.canvas.selected_nodes));
    },

    disconnectLinksBetween(sources, targets) {
        if (!sources.length || !targets.length) return;
        
        const graph = app.canvas.graph;
        
        const sourceIds = new Set(sources.map(n => n.id));
        let changed = false;

        for (const target of targets) {
            if (!target.inputs) continue;
            for (let i = 0; i < target.inputs.length; i++) {
                const linkId = target.inputs[i].link;
                if (linkId !== null) {
                    const link = graph.links[linkId];
                    if (link && sourceIds.has(link.origin_id)) {
                        target.disconnectInput(i);
                        changed = true;
                    }
                }
            }
        }
        if (changed) graph.setDirtyCanvas(true, true);
    },

    clearSelectedInternalLinks() {
        const selectedNodes = Object.values(app.canvas.selected_nodes || {});
        if (selectedNodes.length === 0) return;

        const graph = app.canvas.graph;
        let changed = false;

        // 单选模式：断开该节点的所有连接（输入和输出）
        if (selectedNodes.length === 1) {
            const node = selectedNodes[0];

            // 1. 断开所有输入
            if (node.inputs) {
                for (let i = 0; i < node.inputs.length; i++) {
                    if (node.inputs[i].link !== null) {
                        node.disconnectInput(i);
                        changed = true;
                    }
                }
            }

            // 2. 断开所有输出
            if (node.outputs) {
                for (let i = 0; i < node.outputs.length; i++) {
                    if (node.outputs[i].links && node.outputs[i].links.length > 0) {
                        node.disconnectOutput(i);
                        changed = true;
                    }
                }
            }
        } 
        // 多选模式：仅断开选中节点内部的连接
        else {
            const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
            
            for (const node of selectedNodes) {
                if (!node.inputs) continue;
                for (let i = 0; i < node.inputs.length; i++) {
                    const linkId = node.inputs[i].link;
                    if (linkId !== null) {
                        const link = graph.links[linkId];
                        // 只有当连线的起点也在选中列表中时，才断开
                        if (link && selectedNodeIds.has(link.origin_id)) {
                            node.disconnectInput(i);
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) graph.setDirtyCanvas(true, true);
    },

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

    sortNodesByStrictLeft(nodes) {
        return nodes.sort((a, b) => {
            if (a.pos[0] !== b.pos[0]) return a.pos[0] - b.pos[0];
            if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
            return a.id - b.id;
        });
    },

    connectSourcesToTarget(sources, targetNode, options = {}) {
        if (!targetNode.inputs) return false;

        const { 
            force = false, 
            offset = 0, 
            cycleTargetSlots = false, 
            cycleSourceSlots = false,
            sharedUsedOutputs = null 
        } = options;

        let connectionMade = false;
        
        // 如果外部没有传，则使用局部的 Set
        const usedSourceOutputs = sharedUsedOutputs || new Set(); 
        
        const inputCount = targetNode.inputs.length;
        const matchStrategy = getSetting("FastLink.MatchStrategy", "name_type");

        const graph = app.canvas.graph;

        for (let k = 0; k < inputCount; k++) {
            const i = cycleTargetSlots ? (k + offset) % inputCount : k;
            const input = targetNode.inputs[i];
            
            if (input.link && !force) continue;

            let bestMatch = null;
            let bestMatchScore = -1; // 初始分设为 -1，允许 0 分以上的任何匹配

            for (const sourceNode of sources) {
                if (!sourceNode.outputs) continue;
                const outputCount = sourceNode.outputs.length;

                for (let m = 0; m < outputCount; m++) {
                    const j = cycleSourceSlots ? (m + offset) % outputCount : m;
                    const output = sourceNode.outputs[j];
                    
                    const outputId = `${sourceNode.id}_${j}`;

                    // 1. 如果不是轮询模式，我们需要检查端口占用
                    // 2. 如果是 ManyToOne (sharedUsedOutputs 为空)，通常不希望重复连同一个源端口，所以 continue
                    // 3. 如果是 OneToMany (sharedUsedOutputs 存在)，我们希望允许复用(降级)，所以这里不 continue
                    if (!cycleSourceSlots && usedSourceOutputs.has(outputId)) {
                        if (!sharedUsedOutputs) {
                            continue; // 多对一：严格跳过已用端口
                        }
                        // 一对多：允许进入下方逻辑，进行降权评分
                    }

                    if (input.link) {
                        const link = graph.links[input.link];
                        if (link && link.origin_id === sourceNode.id && link.origin_slot === j) continue;
                    }

                    // --- 匹配评分逻辑 ---
                    let currentScore = 0;
                    const inputType = input.type;
                    const outputType = output.type;
                    const isInputWildcard = inputType === "*" || inputType === "REROUTE";
                    const isOutputWildcard = outputType === "*" || outputType === "REROUTE";
                    
                    // 【修复】增强兼容性判定：如果类型完全相等或包含通配符，或列表类型存在交集
                    let isCompatible = (inputType === outputType) || isInputWildcard || isOutputWildcard;

                    // 尝试处理 "VIDEO,STRING" 这种多类型情况
                    if (!isCompatible && typeof inputType === "string" && typeof outputType === "string") {
                        if (inputType.includes(",") || outputType.includes(",")) {
                            // 分割并去除空格
                            const iTypes = inputType.split(",").map(t => t.trim());
                            const oTypes = outputType.split(",").map(t => t.trim());
                            // 检查是否有交集
                            isCompatible = iTypes.some(t => oTypes.includes(t));
                        }
                    }

                    if (!isCompatible) continue;

                    // 1. 基础匹配分 (1 ~ 3 分)
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

                    // 2. 占用状态分 (0 或 10 分)
                    // 奖励机制：未被占用的端口获得高额奖励
                    if (sharedUsedOutputs && usedSourceOutputs.has(outputId)) {
                        // 已被占用：不加奖励分 (保持基础分 1~3，大于初始值 -1，所以能被选中)
                        // currentScore += 0; 
                    } else {
                         // 未被占用：给予高额奖励 (基础分 + 10 = 11~13)
                         currentScore += 10;
                    }

                    if (currentScore > bestMatchScore) {
                        bestMatchScore = currentScore;
                        bestMatch = { sourceNode, outputIndex: j };
                    }
                }
            }

            if (bestMatch) {
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
            app.canvas.graph.setDirtyCanvas(true, true);
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
        
        // 共享 Set：用于在多个目标节点之间协调端口占用情况
        const batchUsedSourceOutputs = new Set();
        const sharedOptions = { ...options, sharedUsedOutputs: batchUsedSourceOutputs };

        let changed = false;
        for (const targetNode of targetNodes) {
            if (this.connectSourcesToTarget([sourceNode], targetNode, sharedOptions)) {
                changed = true;
            }
        }

        if (changed) app.canvas.graph.setDirtyCanvas(true, true);
    },

    connectDaisyChain() {
        const nodes = this.getSortedSelection();
        if (nodes.length < 2) return;

        let changed = false;
        let currentSource = nodes[0];

        for (let i = 1; i < nodes.length; i++) {
            const target = nodes[i];
            if (this.connectSourcesToTarget([currentSource], target, { force: false })) {
                currentSource = target;
                changed = true;
            } 
        }

        if (changed) app.canvas.graph.setDirtyCanvas(true, true);
    }
});