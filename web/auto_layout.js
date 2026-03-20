import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Comfy.AutoLayout.Auto",
    async setup() {
        // 暴露实例给外部调用
        window.__comfy_auto_layout_instance = this;

        window.addEventListener("keydown", (e) => {
            const activeTag = document.activeElement.tagName;
            if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

            // 检查总开关
            const isEnabled = app.extensionManager.setting.get("AutoLayout.Enabled") ?? true;
            if (!isEnabled) return;

            // 读取配置
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
        console.log("AutoLayout: Module Loaded with unified topological depth & slot sorting.");
    },

    /**
     * 辅助函数：安全获取 Link 对象
     */
    getLink(linkId, graph) {
        if (linkId == null) return null;
        return graph.links?.[linkId] ?? app.graph.links?.[linkId];
    },

    /**
     * 获取节点组（连通分量）
     */
    getConnectedGroups(nodes, graph) {
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
                            const link = this.getLink(inp.link, graph);
                            if (!link) continue;
                            const srcId = link.origin_id;
                            if (nodeSet.has(srcId) && !visited.has(srcId)) {
                                visited.add(srcId);
                                const srcNode = graph.getNodeById(srcId);
                                if (srcNode) queue.push(srcNode);
                            }
                        }
                    }
                }

                if (curr.outputs) {
                    for (const out of curr.outputs) {
                        if (out.links) {
                            for (const linkId of out.links) {
                                const link = this.getLink(linkId, graph);
                                if (!link) continue;
                                const dstId = link.target_id;
                                if (nodeSet.has(dstId) && !visited.has(dstId)) {
                                    visited.add(dstId);
                                    const dstNode = graph.getNodeById(dstId);
                                    if (dstNode) queue.push(dstNode);
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
        const graph = app.canvas.graph;
        const selectedNodesMap = app.canvas.selected_nodes;
        let targetNodes = [];

        // 读取所有配置
        const horizontalGap = Number(app.extensionManager.setting.get("AutoLayout.HorizontalGap") ?? 80);
        const rowHeightGap = Number(app.extensionManager.setting.get("AutoLayout.VerticalGap") ?? 60);
        const islandGap = Number(app.extensionManager.setting.get("AutoLayout.IslandGap") ?? 150);
        const islandDir = app.extensionManager.setting.get("AutoLayout.IslandDirection") ?? "Vertical";
        const layoutDir = app.extensionManager.setting.get("AutoLayout.Direction") ?? "Right-to-Left";
        const gravity = app.extensionManager.setting.get("AutoLayout.Gravity") ?? "Source-Aligned";

        if (selectedNodesMap && Object.keys(selectedNodesMap).length > 0) {
            targetNodes = Object.values(selectedNodesMap);
        } else {
            targetNodes = graph._nodes;
        }

        if (!targetNodes || targetNodes.length === 0) return;

        const groups = this.getConnectedGroups(targetNodes, graph);

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

        if (targetNodes.length > 0) {
            const allMinY = Math.min(...targetNodes.map(n => n.pos[1]));

            if (isReverse) {
                const allMaxRight = Math.max(...targetNodes.map(n => n.pos[0] + n.size[0]));
                anchorX = allMaxRight;
            } else {
                const allMinX = Math.min(...targetNodes.map(n => n.pos[0]));
                anchorX = allMinX;
            }
            anchorY = allMinY;
        } else {
            anchorX = isReverse ? 1200 : 100;
            anchorY = 100;
        }

        let currentGroupX = anchorX;
        let currentGroupY = anchorY;

        for (const group of groups) {
            const groupBounds = this.layoutGroup(
                group,
                graph,
                currentGroupX,
                currentGroupY,
                horizontalGap,
                rowHeightGap,
                isReverse,
                gravity
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
     * 单组布局实现 (全新升级双向拓扑算法)
     */
    layoutGroup(nodes, graph, anchorX, startY, horizontalGap, rowHeightGap, isReverse, gravity) {
        const targetIds = new Set(nodes.map(n => n.id));
        const nodeDepths = {};
        nodes.forEach(n => nodeDepths[n.id] = 0);

        const isSourceGravity = gravity.includes("Source");

        // ======= 第一步：生成统一方向的逻辑深度矩阵 (0永远是逻辑源头) =======
        if (isSourceGravity) {
            // ASAP 策略：起点对齐
            // 1. 正向推导：主心骨排列
            for (let i = 0; i < nodes.length + 1; i++) {
                let changed = false;
                nodes.forEach(node => {
                    node.inputs?.forEach(inp => {
                        if (inp.link) {
                            const l = this.getLink(inp.link, graph);
                            if (l && targetIds.has(l.origin_id) && nodeDepths[node.id] <= nodeDepths[l.origin_id]) {
                                nodeDepths[node.id] = nodeDepths[l.origin_id] + 1;
                                changed = true;
                            }
                        }
                    });
                });
                if (!changed) break;
            }

            // 2. 反向拉拽：消除悬空节点 (修复 B2, E2 挤在起点的问题)
            for (let i = 0; i < nodes.length + 1; i++) {
                let changed = false;
                nodes.forEach(node => {
                    let minChildDepth = 99999;
                    let hasChild = false;
                    node.outputs?.forEach(out => out.links?.forEach(lId => {
                        const l = this.getLink(lId, graph);
                        if (l && targetIds.has(l.target_id)) {
                            hasChild = true;
                            minChildDepth = Math.min(minChildDepth, nodeDepths[l.target_id]);
                        }
                    }));
                    // 如果节点的深度距离其直接子节点跨度大于1，强行把它拉倒子节点的前一列
                    if (hasChild && nodeDepths[node.id] < minChildDepth - 1) {
                        nodeDepths[node.id] = minChildDepth - 1;
                        changed = true;
                    }
                });
                if (!changed) break;
            }
        } else {
            // ALAP 策略：终点对齐
            // 1. 逆向反推：确保所有的末端输出节点都在统一列
            for (let i = 0; i < nodes.length + 1; i++) {
                let changed = false;
                nodes.forEach(node => {
                    node.outputs?.forEach(out => out.links?.forEach(lId => {
                        const l = this.getLink(lId, graph);
                        if (l && targetIds.has(l.target_id) && nodeDepths[node.id] <= nodeDepths[l.target_id]) {
                            nodeDepths[node.id] = nodeDepths[l.target_id] + 1;
                            changed = true;
                        }
                    }));
                });
                if (!changed) break;
            }

            // 2. 深度反转：此时终点是 0，我们反转它，让 0 依然代表画面的逻辑起点
            let maxDepth = 0;
            for (const id in nodeDepths) maxDepth = Math.max(maxDepth, nodeDepths[id]);
            for (const id in nodeDepths) nodeDepths[id] = maxDepth - nodeDepths[id];
        }

        // ======= 第二步：分列计算 =======
        const columns = {};
        const colMaxWidths = {};
        nodes.forEach(node => {
            const d = nodeDepths[node.id];
            if (!columns[d]) columns[d] = [];
            columns[d].push(node);
            colMaxWidths[d] = Math.max(colMaxWidths[d] || 0, node.size[0]);
        });

        // 根据用户的物理习惯，决定从左往右渲染还是从右往左渲染列
        const sortedDepths = Object.keys(columns).sort((a, b) => {
            return isReverse ? (parseInt(b) - parseInt(a)) : (parseInt(a) - parseInt(b));
        });

        let currentXBase = anchorX;
        let maxGroupY = startY;
        let totalGroupWidth = 0;

        // ======= 第三步：逐列对齐与排序渲染 =======
        sortedDepths.forEach(depthStr => {
            const depth = parseInt(depthStr);
            const colNodes = columns[depth];
            const colWidth = colMaxWidths[depth];
            totalGroupWidth += (colWidth + horizontalGap);

            const colLeftX = isReverse ? (currentXBase - colWidth) : currentXBase;

            // ✨ 核心改进：引入物理 Y 坐标与端口 Index 双重排序策略
            colNodes.sort((a, b) => {
                const getSortKey = (node) => {
                    let sumSlot = 0;
                    let count = 0;
                    let minParentY = 99999;

                    if (isReverse) {
                        // 倒排模式下，先放置的是深一层的节点（子节点），所以看 Outputs
                        node.outputs?.forEach(out => out.links?.forEach(lId => {
                            const l = this.getLink(lId, graph);
                            if (l && targetIds.has(l.target_id) && nodeDepths[l.target_id] > depth) {
                                const childNode = graph.getNodeById(l.target_id);
                                minParentY = Math.min(minParentY, childNode.pos[1]);
                                sumSlot += l.target_slot; // 取子节点的输入端口序号
                                count++;
                            }
                        }));
                    } else {
                        // 顺排模式下，先放置的是浅一层的节点（父节点），所以看 Inputs
                        node.inputs?.forEach(inp => {
                            if (inp.link) {
                                const l = this.getLink(inp.link, graph);
                                if (l && targetIds.has(l.origin_id) && nodeDepths[l.origin_id] < depth) {
                                    const parentNode = graph.getNodeById(l.origin_id);
                                    minParentY = Math.min(minParentY, parentNode.pos[1]);
                                    sumSlot += l.origin_slot; // 取父节点的输出端口序号
                                    count++;
                                }
                            }
                        });
                    }

                    if (count === 0) return { y: node.pos[1], slot: 0 };
                    return { y: minParentY, slot: sumSlot / count };
                };

                const keyA = getSortKey(a);
                const keyB = getSortKey(b);

                // 第一权重：父节点/子节点的物理高度，高度相差超过 10 像素时绝对服从
                if (Math.abs(keyA.y - keyB.y) > 10) {
                    return keyA.y - keyB.y;
                }
                // 第二权重：父节点/子节点身上的接口索引（按照插槽从上到下严格排列）
                return keyA.slot - keyB.slot;
            });

            // 最终物理放置
            let currentCursorY = startY;
            colNodes.forEach(node => {
                let targetY = -1;

                const findTarget = () => {
                    let rel = [];
                    if (isReverse) {
                        node.outputs?.forEach(o => o.links?.forEach(lid => {
                            const l = this.getLink(lid, graph);
                            if (l && nodeDepths[l.target_id] > depth) rel.push(l.target_id);
                        }));
                    } else {
                        node.inputs?.forEach(i => {
                            if (i.link) {
                                const l = this.getLink(i.link, graph);
                                if (l && nodeDepths[l.origin_id] < depth) rel.push(l.origin_id);
                            }
                        });
                    }
                    return rel.length === 1 ? graph.getNodeById(rel[0]) : null;
                };

                const tNode = findTarget();
                if (tNode) targetY = tNode.pos[1];

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