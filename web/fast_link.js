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
        
        // 【修复 1】使用 app.canvas.graph 兼容子图
        const graph = app.canvas.graph;
        
        const sourceIds = new Set(sources.map(n => n.id));
        let changed = false;

        for (const target of targets) {
            if (!target.inputs) continue;
            for (let i = 0; i < target.inputs.length; i++) {
                const linkId = target.inputs[i].link;
                if (linkId !== null) {
                    // 【修复 1】使用 graph.links
                    const link = graph.links[linkId];
                    if (link && sourceIds.has(link.origin_id)) {
                        target.disconnectInput(i);
                        changed = true;
                    }
                }
            }
        }
        // 【修复 1】使用 graph.setDirtyCanvas
        if (changed) graph.setDirtyCanvas(true, true);
    },

    clearSelectedInternalLinks() {
        const selectedNodes = Object.values(app.canvas.selected_nodes || {});
        if (selectedNodes.length < 2) return;

        const graph = app.canvas.graph; // 【修复 1】

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        let changed = false;

        for (const node of selectedNodes) {
            if (!node.inputs) continue;
            for (let i = 0; i < node.inputs.length; i++) {
                const linkId = node.inputs[i].link;
                if (linkId !== null) {
                    const link = graph.links[linkId]; // 【修复 1】
                    if (link && selectedNodeIds.has(link.origin_id)) {
                        node.disconnectInput(i);
                        changed = true;
                    }
                }
            }
        }
        if (changed) graph.setDirtyCanvas(true, true); // 【修复 1】
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
            sharedUsedOutputs = null // 【修复 2】新增参数：接收外部传入的已用端口记录
        } = options;

        let connectionMade = false;
        
        // 如果外部没有传，则使用局部的 Set（多对一模式通常如此）
        // 如果外部传了（一对多模式），则使用共享的 Set
        const usedSourceOutputs = sharedUsedOutputs || new Set(); 
        
        const inputCount = targetNode.inputs.length;
        const matchStrategy = getSetting("FastLink.MatchStrategy", "name_type");

        // 【修复 1】使用 app.canvas.graph
        const graph = app.canvas.graph;

        for (let k = 0; k < inputCount; k++) {
            const i = cycleTargetSlots ? (k + offset) % inputCount : k;
            const input = targetNode.inputs[i];
            
            if (input.link && !force) continue;

            let bestMatch = null;
            let bestMatchScore = 0;

            for (const sourceNode of sources) {
                if (!sourceNode.outputs) continue;
                const outputCount = sourceNode.outputs.length;

                for (let m = 0; m < outputCount; m++) {
                    const j = cycleSourceSlots ? (m + offset) % outputCount : m;
                    const output = sourceNode.outputs[j];
                    
                    const outputId = `${sourceNode.id}_${j}`;

                    // 【修复 2】改进的占用检查逻辑
                    // 只有当 cycleSourceSlots=false (非轮询源接口模式) 时才检查占用
                    if (!cycleSourceSlots) {
                        // 检查这个端口是否在本次批处理中被用过
                        if (usedSourceOutputs.has(outputId)) {
                            // 如果被用过，我们不立即跳过，而是给它一个极低的分数（降级）
                            // 这样：如果有空闲端口，优先连空闲的；如果全满了，才允许广播（连已用的）。
                            // 除非是 ManyToOne (多汇聚一)，此时通常不希望同一个源连同一个目标两次，所以可以保持跳过。
                            // 但为了简化逻辑，我们这里采取：如果外部传入了 sharedSet (一对多模式)，我们进行降级；否则跳过。
                            if (sharedUsedOutputs) {
                                // 这是一个已用的端口，稍后评分时会扣分
                            } else {
                                continue; // 多对一模式下，同一个源只连一次
                            }
                        }
                    }

                    if (input.link) {
                        const link = graph.links[input.link]; // 【修复 1】
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

                    // 【修复 2】关键：如果该端口已被使用，大幅扣分，迫使算法优先寻找其他空闲端口
                    if (sharedUsedOutputs && usedSourceOutputs.has(outputId)) {
                        currentScore -= 10; // 扣大分，变成负分也没关系，只要比其他更差就行
                        // 但要保证比 0 大吗？不，只要算法能处理。
                        // 这里简单处理：如果它是唯一匹配，currentScore 即使很低也会被选中（因为 bestMatchScore 初始 0，需要调整）
                        // 修正：如果 currentScore <= 0，我们就不连了？不，我们希望连。
                        // 所以不仅要扣分，还要保证 bestMatchScore 的初始值逻辑能接受它。
                        // 我们把“未占用”的基础分都 +100，占用的保持原分。
                    } else {
                         currentScore += 100; // 未占用的端口，给予巨大优势
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
        // 【修复 1】使用 app.canvas.graph
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
        
        // 【修复 2】创建一个在本次“一对多”操作中共享的 Set
        // 这样 Target A 用了 Output 1 后，Target B 就会知道，从而优先选 Output 2
        const batchUsedSourceOutputs = new Set();
        const sharedOptions = { ...options, sharedUsedOutputs: batchUsedSourceOutputs };

        let changed = false;
        for (const targetNode of targetNodes) {
            // 将共享 Set 传入
            if (this.connectSourcesToTarget([sourceNode], targetNode, sharedOptions)) {
                changed = true;
            }
        }
        // 【修复 1】使用 app.canvas.graph
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
        // 【修复 1】使用 app.canvas.graph
        if (changed) app.canvas.graph.setDirtyCanvas(true, true);
    }
});