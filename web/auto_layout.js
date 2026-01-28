import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Comfy.AutoLayout.Auto",
    async setup() {
        // 暴露实例给外部调用
        window.__comfy_auto_layout_instance = this;

        window.addEventListener("keydown", (e) => {
            const activeTag = document.activeElement.tagName;
            if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

            // 检查总开关 (ID 更新为 AutoLayout.Enabled)
            const isEnabled = app.extensionManager.setting.get("AutoLayout.Enabled") ?? true;
            if (!isEnabled) return;

            // 读取配置 (ID 更新为 AutoLayout.Shortcut)
            const shortcutStr = (app.extensionManager.setting.get("AutoLayout.Shortcut") || "Alt+L").toUpperCase();
            
            const parts = shortcutStr.split("+").map(s => s.trim());
            const key = parts.pop();
            const modifiers = parts;

            const altRequired = modifiers.includes("ALT");
            const ctrlRequired = modifiers.includes("CTRL");
            const shiftRequired = modifiers.includes("SHIFT");
            const metaRequired = modifiers.includes("META") || modifiers.includes("CMD");

            if (e.key.toUpperCase() === key) {
                if (altRequired && !e.altKey) return;
                if (ctrlRequired && !e.ctrlKey) return;
                if (shiftRequired && !e.shiftKey) return;
                if (metaRequired && !e.metaKey) return;

                e.preventDefault();
                e.stopPropagation();
                this.arrangeNodes();
            }
        });
        console.log("AutoLayout: Module Loaded with synchronized IDs.");
    },

    /**
     * 获取节点组（连通分量）
     */
    getConnectedGroups(nodes, links) {
        const groups = [];
        const visited = new Set();
        const nodeSet = new Set(nodes.map(n => n.id));

        for (const node of nodes) {
            if (visited.has(node.id)) continue;

            const group = [];
            const queue = [node];
            visited.add(node.id);

            while (queue.length > 0) {
                const curr = queue.shift();
                group.push(curr);

                if (curr.inputs) {
                    for (const inp of curr.inputs) {
                        if (inp.link) {
                            const link = links[inp.link];
                            if (!link) continue;
                            const srcId = link.origin_id;
                            if (nodeSet.has(srcId) && !visited.has(srcId)) {
                                visited.add(srcId);
                                queue.push(app.graph.getNodeById(srcId));
                            }
                        }
                    }
                }

                if (curr.outputs) {
                    for (const out of curr.outputs) {
                        if (out.links) {
                            for (const linkId of out.links) {
                                const link = links[linkId];
                                if (!link) continue;
                                const dstId = link.target_id;
                                if (nodeSet.has(dstId) && !visited.has(dstId)) {
                                    visited.add(dstId);
                                    queue.push(app.graph.getNodeById(dstId));
                                }
                            }
                        }
                    }
                }
            }
            groups.push(group);
        }
        return groups;
    },

    /**
     * 主排列函数
     */
    arrangeNodes() {
        const graph = app.graph;
        const selectedNodesMap = app.canvas.selected_nodes;
        let targetNodes = [];
        let isSelectionMode = false;

        // 读取所有配置 (所有 ID 均从 AlignLayout 改为 AutoLayout)
        const horizontalGap = Number(app.extensionManager.setting.get("AutoLayout.HorizontalGap") ?? 80);
        const rowHeightGap = Number(app.extensionManager.setting.get("AutoLayout.VerticalGap") ?? 60);
        const islandGap = Number(app.extensionManager.setting.get("AutoLayout.IslandGap") ?? 150);
        const islandDir = app.extensionManager.setting.get("AutoLayout.IslandDirection") ?? "Vertical";
        const layoutDir = app.extensionManager.setting.get("AutoLayout.Direction") ?? "Right-to-Left";

        if (selectedNodesMap && Object.keys(selectedNodesMap).length > 0) {
            targetNodes = Object.values(selectedNodesMap);
            isSelectionMode = true;
        } else {
            targetNodes = graph._nodes;
        }

        if (!targetNodes || targetNodes.length === 0) return;

        const groups = this.getConnectedGroups(targetNodes, graph.links);

        groups.sort((g1, g2) => {
            if (islandDir === "Vertical") {
                const y1 = g1.reduce((acc, n) => acc + n.pos[1], 0) / g1.length;
                const y2 = g2.reduce((acc, n) => acc + n.pos[1], 0) / g2.length;
                return y1 - y2;
            } else {
                const x1 = g1.reduce((acc, n) => acc + n.pos[0], 0) / g1.length;
                const x2 = g2.reduce((acc, n) => acc + n.pos[0], 0) / g2.length;
                return x1 - x2;
            }
        });

        const isReverse = layoutDir.includes("Right-to-Left");
        let anchorX, anchorY;

        if (isSelectionMode) {
            if (isReverse) {
                anchorX = Math.max(...targetNodes.map(n => n.pos[0] + n.size[0]));
            } else {
                anchorX = Math.min(...targetNodes.map(n => n.pos[0]));
            }
            anchorY = Math.min(...targetNodes.map(n => n.pos[1]));
        } else {
            anchorX = isReverse ? 1200 : 100;
            anchorY = 100;
        }

        let currentGroupX = anchorX;
        let currentGroupY = anchorY;

        for (const group of groups) {
            const groupBounds = this.layoutGroup(
                group, 
                graph.links, 
                currentGroupX, 
                currentGroupY, 
                horizontalGap, 
                rowHeightGap, 
                isReverse,
                graph
            );
            
            if (islandDir === "Vertical") {
                currentGroupY += groupBounds.height + islandGap;
            } else {
                if (isReverse) {
                    currentGroupX -= (groupBounds.width + islandGap);
                } else {
                    currentGroupX += (groupBounds.width + islandGap);
                }
            }
        }

        graph.change(); 
        graph.setDirtyCanvas(true, true);
    },

    /**
     * 单组布局实现
     */
    layoutGroup(nodes, links, anchorX, startY, horizontalGap, rowHeightGap, isReverse, graph) {
        const targetIds = new Set(nodes.map(n => n.id));
        const nodeDepths = {};
        nodes.forEach(n => nodeDepths[n.id] = 0);

        for (let i = 0; i < nodes.length + 1; i++) {
            let changed = false;
            nodes.forEach(node => {
                if (isReverse) {
                    if (node.outputs) {
                        node.outputs.forEach(out => out.links?.forEach(lId => {
                            const l = links[lId];
                            if (l && targetIds.has(l.target_id) && nodeDepths[node.id] <= nodeDepths[l.target_id]) {
                                nodeDepths[node.id] = nodeDepths[l.target_id] + 1;
                                changed = true;
                            }
                        }));
                    }
                } else {
                    if (node.inputs) {
                        node.inputs.forEach(inp => {
                            const l = links[inp.link];
                            if (l && targetIds.has(l.origin_id) && nodeDepths[node.id] <= nodeDepths[l.origin_id]) {
                                nodeDepths[node.id] = nodeDepths[l.origin_id] + 1;
                                changed = true;
                            }
                        });
                    }
                }
            });
            if (!changed) break;
        }

        const columns = {};
        const colMaxWidths = {};
        nodes.forEach(node => {
            const d = nodeDepths[node.id];
            if (!columns[d]) columns[d] = [];
            columns[d].push(node);
            colMaxWidths[d] = Math.max(colMaxWidths[d] || 0, node.size[0]);
        });

        const sortedDepths = Object.keys(columns).sort((a, b) => parseInt(a) - parseInt(b));
        let currentXBase = anchorX;
        let maxGroupY = startY;
        let totalGroupWidth = 0;

        sortedDepths.forEach(depthStr => {
            const depth = parseInt(depthStr);
            const colNodes = columns[depth];
            const colWidth = colMaxWidths[depth];
            totalGroupWidth += (colWidth + horizontalGap);

            const colLeftX = isReverse ? (currentXBase - colWidth) : currentXBase;

            if (depth > 0) {
                colNodes.sort((a, b) => {
                    const getSlot = (n) => {
                        let minS = 999;
                        if (isReverse) {
                            n.outputs?.forEach(o => o.links?.forEach(lid => {
                                const l = links[lid];
                                if (l && nodeDepths[l.target_id] === depth - 1) minS = Math.min(minS, l.target_slot);
                            }));
                        } else {
                            n.inputs?.forEach((inp, idx) => {
                                const l = links[inp.link];
                                if (l && nodeDepths[l.origin_id] === depth - 1) minS = Math.min(minS, idx);
                            });
                        }
                        return minS;
                    };
                    return getSlot(a) - getSlot(b);
                });
            } else {
                colNodes.sort((a, b) => a.pos[1] - b.pos[1]);
            }

            let currentCursorY = startY;
            colNodes.forEach(node => {
                let targetY = -1;
                if (depth > 0) {
                    const findTarget = () => {
                        if (isReverse) {
                            let rel = [];
                            node.outputs?.forEach(o => o.links?.forEach(lid => {
                                const l = links[lid];
                                if (l && nodeDepths[l.target_id] === depth - 1) rel.push(l.target_id);
                            }));
                            return rel.length === 1 ? graph.getNodeById(rel[0]) : null;
                        } else {
                            let rel = [];
                            node.inputs?.forEach(i => {
                                const l = links[i.link];
                                if (l && nodeDepths[l.origin_id] === depth - 1) rel.push(l.origin_id);
                            });
                            return rel.length === 1 ? graph.getNodeById(rel[0]) : null;
                        }
                    };
                    const tNode = findTarget();
                    if (tNode) targetY = tNode.pos[1];
                }

                const finalY = (targetY !== -1 && targetY >= currentCursorY) ? targetY : currentCursorY;
                node.pos[1] = finalY;
                node.pos[0] = isReverse ? (currentXBase - node.size[0]) : colLeftX;

                currentCursorY = finalY + node.size[1] + rowHeightGap;
                if (currentCursorY > maxGroupY) maxGroupY = currentCursorY;
            });

            currentXBase = isReverse ? (colLeftX - horizontalGap) : (colLeftX + colWidth + horizontalGap);
        });

        return {
            width: totalGroupWidth - horizontalGap,
            height: maxGroupY - startY
        };
    }
});