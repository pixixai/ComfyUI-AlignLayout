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
        console.log("AutoLayout: Module Loaded with Native Hierarchy & Safe Bounding Box.");
    },

    /**
     * 辅助函数：安全获取 Link 对象
     */
    getLink(linkId, graph) {
        if (linkId == null) return null;
        return graph.links?.[linkId] ?? app.graph.links?.[linkId];
    },

    /**
     * 主排列函数 (引入官方原生递归嵌套布局逻辑)
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
        const isReverse = layoutDir.includes("Right-to-Left");

        // 判断是否是“全局模式”：没有选中任何节点，且没有明确选中任何原生节点组
        const isWholeGraph = (!selectedNodesMap || Object.keys(selectedNodesMap).length === 0) && !app.canvas.selected_group;

        if (!isWholeGraph) {
            targetNodes = Object.values(selectedNodesMap || {});
        } else {
            targetNodes = graph._nodes;
        }

        if ((!targetNodes || targetNodes.length === 0) && !app.canvas.selected_group) return;

        // =========================================================
        // 【第一步】调用官方原生状态刷新
        // 确保所有组内的节点层级关系是最新的
        // =========================================================
        const allGroups = graph._groups || [];
        allGroups.forEach(g => {
            if (typeof g.recomputeInsideNodes === 'function') {
                g.recomputeInsideNodes();
            }
        });

        // =========================================================
        // 核心变更：精准感知节点组的选择状态
        // =========================================================
        let expandedNodes = new Set(targetNodes);
        let relevantGroups = new Set();
        
        if (isWholeGraph) {
            // 全局模式：纳入所有组
            allGroups.forEach(g => relevantGroups.add(g));
        } else {
            // 局部模式：检测用户是否明确选中了原生节点组 (LiteGraph 的 selected_group)
            if (app.canvas.selected_group) {
                relevantGroups.add(app.canvas.selected_group);
            }
            
            // ✨ 新增智能感知框选：如果用户框选了某个组内的【所有节点】，智能推断用户意图为选中该组
            allGroups.forEach(g => {
                const groupNodes = g.nodes || [];
                if (groupNodes.length > 0) {
                    // 检查组内的每一个节点是否都在 expandedNodes (被选中的节点集合) 中
                    const allSelected = Array.from(groupNodes).every(n => expandedNodes.has(n));
                    if (allSelected) {
                        relevantGroups.add(g);
                    }
                }
            });
        }

        let changed = true;
        while(changed) {
            changed = false;
            for (const g of relevantGroups) {
                // 只扩充被标记为“相关”的组，不再无脑绑架未选中的组内的节点
                const groupNodes = g.nodes || [];
                groupNodes.forEach(n => {
                    if (!expandedNodes.has(n)) {
                        expandedNodes.add(n);
                        changed = true;
                    }
                });
            }
        }
        targetNodes = Array.from(expandedNodes);

        // =========================================================
        // 【第二步】利用官方属性构建纯正嵌套树
        // =========================================================
        const entities = [...targetNodes, ...Array.from(relevantGroups)];
        const childrenMap = new Map();
        const parentMap = new Map();
        entities.forEach(e => childrenMap.set(e, []));

        // 按照面积从大到小排序，确保小（内层）组最后执行覆盖绑定，形成完美嵌套树
        const sortedGroups = Array.from(relevantGroups).sort((a, b) => (b.size[0]*b.size[1]) - (a.size[0]*a.size[1]));

        sortedGroups.forEach(g => {
            // 兼容新老版本：优先取 g.children (包含嵌套组)，没有则降级取 g.nodes
            const childrenItems = g.children ? Array.from(g.children) : (g.nodes || []);
            childrenItems.forEach(child => {
                if (entities.includes(child) && child !== g) {
                    parentMap.set(child, g); 
                }
            });
        });

        entities.forEach(entity => {
            const parent = parentMap.get(entity);
            if (parent) {
                childrenMap.get(parent).push(entity);
            }
        });

        // =========================================================
        // 【第三步】自底向上 (Bottom-Up) 递归布局引擎
        // =========================================================
        const _this = this;

        function processEntity(entity) {
            if (!relevantGroups.has(entity)) {
                return {
                    id: "node_" + entity.id,
                    isGroup: false,
                    node: entity,
                    pos: [...entity.pos],
                    size: [...entity.size],
                    entity: entity
                };
            }

            const children = childrenMap.get(entity);
            const childBlocks = children.map(processEntity); // 递归调用，优先排布最底层子集

            if (childBlocks.length > 0) {
                // ✨ 修复 1：向左偏移问题。逆向模式下，子节点的起跑线必须是组的右边缘！
                const childStartX = isReverse ? (entity.pos[0] + entity.size[0]) : entity.pos[0];
                
                // 将内部子集排版，排版后内部节点的坐标已经改变
                _this.layoutBlocks(childBlocks, graph, childStartX, entity.pos[1], horizontalGap, rowHeightGap, isReverse, gravity, islandDir, islandGap);

                // =========================================================
                // ✨ 核心修复：防止空间脱节、"几何绑架"及标题重叠
                // =========================================================
                let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
                childBlocks.forEach(b => {
                    // ✨ 修复 3：补全 LiteGraph 坐标系盲区
                    // 普通节点的主体在 pos[1]，但其标题栏是在 pos[1] 的上方，因此要向上额外延伸 titleHeight。
                    // 节点组(Group)的坐标已经是包含了标题栏的最外层边框，因此不需要延伸。
                    const childTitleHeight = b.isGroup ? 0 : (b.entity.titleHeight || 30);
                    
                    minX = Math.min(minX, b.pos[0]);
                    minY = Math.min(minY, b.pos[1] - childTitleHeight);
                    maxX = Math.max(maxX, b.pos[0] + b.size[0]);
                    maxY = Math.max(maxY, b.pos[1] + b.size[1]);
                });

                const titleHeight = entity.titleHeight || 30; // 动态获取原生标题栏高度
                const paddingSide = 10; 
                
                // ✨ 修复 2：破除 Setter 陷阱与标题重叠问题！
                // 必须重新赋值整个数组 [x, y]，以此触发 LiteGraph 更新底层的 _bounding！
                // 因为上方的 minY 已经精准包住了子节点的标题栏，所以这里再往上推 titleHeight 和 padding 就绝对安全了
                entity.pos = [minX - paddingSide, minY - titleHeight - paddingSide];
                entity.size = [
                    Math.max(140, maxX - minX + paddingSide * 2),
                    Math.max(80, maxY - minY + titleHeight + paddingSide * 2)
                ];
            }

            return {
                id: "group_" + Math.random(),
                isGroup: true,
                group: entity,
                pos: [...entity.pos],
                size: [...entity.size],
                childBlocks: childBlocks,
                entity: entity
            };
        }

        // 提取所有没有父级的“顶级元素”，启动递归排布
        const topLevelEntities = entities.filter(e => !parentMap.get(e));
        const topBlocks = topLevelEntities.map(processEntity);

        if (topBlocks.length > 0) {
            let anchorX, anchorY;
            const allMinY = Math.min(...topBlocks.map(b => b.pos[1]));
            if (isReverse) {
                const allMaxRight = Math.max(...topBlocks.map(b => b.pos[0] + b.size[0]));
                anchorX = allMaxRight;
            } else {
                const allMinX = Math.min(...topBlocks.map(b => b.pos[0]));
                anchorX = allMinX;
            }
            anchorY = allMinY;

            // 最终：排布最顶层的所有 Blocks
            this.layoutBlocks(topBlocks, graph, anchorX, anchorY, horizontalGap, rowHeightGap, isReverse, gravity, islandDir, islandGap);
        }

        // =========================================================
        // 【最终步】全局锁定
        // 所有节点移动结束、所有组的尺寸调整完毕后，做一次彻底的全局刷新
        // 因为此时所有的坐标已经不会相互干涉，重算关系是最安全的
        // =========================================================
        allGroups.forEach(g => {
            if (typeof g.recomputeInsideNodes === 'function') {
                g.recomputeInsideNodes();
            }
        });

        graph.change();
        graph.setDirtyCanvas(true, true);
    },

    /**
     * 针对任意层级的 Block 集合进行拓扑解析与排列
     */
    layoutBlocks(blocks, graph, startX, startY, horizontalGap, rowHeightGap, isReverse, gravity, islandDir, islandGap) {
        if (blocks.length === 0) return { width: 0, height: 0 };

        // 1. 扁平化映射表：让所有底层节点都能找到它所属的当前上下文 Block
        const blockMap = new Map();
        function mapNodes(block, topBlock) {
            if (!block.isGroup) {
                blockMap.set(block.node.id, topBlock);
            } else {
                block.childBlocks.forEach(cb => mapNodes(cb, topBlock));
            }
        }
        blocks.forEach(b => mapNodes(b, b));

        // 2. 动态收集 Block 之间的外部连线
        blocks.forEach(b => {
            b.inputs = [];
            b.outputs = [];
            const nodes = [];
            function collectNodes(blk) {
                if (!blk.isGroup) nodes.push(blk.node);
                else blk.childBlocks.forEach(collectNodes);
            }
            collectNodes(b);

            nodes.forEach(n => {
                n.inputs?.forEach(inp => {
                    const l = this.getLink(inp.link, graph);
                    if (l) {
                        const originBlock = blockMap.get(l.origin_id);
                        if (originBlock && originBlock !== b) {
                            b.inputs.push({ link: inp.link, originBlock, origin_slot: l.origin_slot });
                        }
                    }
                });
                n.outputs?.forEach(out => {
                    out.links?.forEach(lId => {
                        const l = this.getLink(lId, graph);
                        if (l) {
                            const targetBlock = blockMap.get(l.target_id);
                            if (targetBlock && targetBlock !== b) {
                                b.outputs.push({ link: lId, targetBlock, target_slot: l.target_slot });
                            }
                        }
                    });
                });
            });
        });

        // 3. 将当前层级的 Blocks 划分为互不相连的孤岛
        const islands = [];
        const visited = new Set();
        for (const block of blocks) {
            if (visited.has(block.id)) continue;
            const group = [];
            const queue = [block];
            visited.add(block.id);

            while (queue.length > 0) {
                const curr = queue.shift();
                group.push(curr);

                curr.inputs.forEach(inp => {
                    const src = inp.originBlock;
                    if (src && !visited.has(src.id)) {
                        visited.add(src.id);
                        queue.push(src);
                    }
                });
                curr.outputs.forEach(out => {
                    const dst = out.targetBlock;
                    if (dst && !visited.has(dst.id)) {
                        visited.add(dst.id);
                        queue.push(dst);
                    }
                });
            }
            islands.push(group);
        }

        // 4. 排序并渲染孤岛
        islands.sort((g1, g2) => {
            if (islandDir === "Vertical") {
                const y1 = g1.reduce((acc, b) => acc + b.pos[1], 0) / g1.length;
                const y2 = g2.reduce((acc, b) => acc + b.pos[1], 0) / g2.length;
                return y1 - y2;
            } else {
                const x1 = g1.reduce((acc, b) => acc + b.pos[0], 0) / g1.length;
                const x2 = g2.reduce((acc, b) => acc + b.pos[0], 0) / g2.length;
                return x1 - x2;
            }
        });

        let currentGroupX = startX;
        let currentGroupY = startY;
        let maxW = 0, maxH = 0;

        for (const island of islands) {
            const bounds = this.layoutIsland(island, graph, currentGroupX, currentGroupY, horizontalGap, rowHeightGap, isReverse, gravity);

            // 递归应用坐标平移 (Shift)
            function shiftBlock(block, dx, dy) {
                // ✨ 同样必须通过生成新数组来触发 LiteGraph 的 Setter，保持内部状态同步！
                block.pos = [block.pos[0] + dx, block.pos[1] + dy];
                if (block.isGroup) {
                    block.group.pos = [block.pos[0], block.pos[1]];
                    block.childBlocks.forEach(cb => shiftBlock(cb, dx, dy));
                } else {
                    block.node.pos = [block.pos[0], block.pos[1]];
                }
            }

            island.forEach(b => {
                const dx = b._newPos[0] - b.pos[0];
                const dy = b._newPos[1] - b.pos[1];
                shiftBlock(b, dx, dy);
            });

            if (islandDir === "Vertical") {
                currentGroupY += bounds.height + islandGap;
                maxH = currentGroupY - startY;
                maxW = Math.max(maxW, bounds.width);
            } else {
                if (isReverse) {
                    currentGroupX -= (bounds.width + islandGap);
                    maxW = startX - currentGroupX;
                } else {
                    currentGroupX += (bounds.width + islandGap);
                    maxW = currentGroupX - startX;
                }
                maxH = Math.max(maxH, bounds.height);
            }
        }

        return { width: maxW, height: maxH };
    },

    /**
     * 单个孤岛内的完美对齐核心引擎 (修复 Sink-Aligned 问题)
     */
    layoutIsland(items, graph, anchorX, startY, horizontalGap, rowHeightGap, isReverse, gravity) {
        const nodeDepths = {};
        items.forEach(i => nodeDepths[i.id] = 0);

        // 强健判断：明确识别 Sink-Aligned（无论是否被翻译）
        const isSinkGravity = gravity === "Sink-Aligned" || gravity.includes("Sink") || gravity.includes("终点");
        const isSourceGravity = !isSinkGravity;

        // ======= 深度引力推导 =======
        if (isSourceGravity) {
            // ASAP：向右正向推导
            for (let i = 0; i < items.length + 1; i++) {
                let changed = false;
                items.forEach(item => {
                    item.inputs.forEach(inp => {
                        const srcItem = inp.originBlock;
                        if (srcItem && nodeDepths[item.id] <= nodeDepths[srcItem.id]) {
                            nodeDepths[item.id] = nodeDepths[srcItem.id] + 1;
                            changed = true;
                        }
                    });
                });
                if (!changed) break;
            }
            // 修复悬空节点挤在一堆
            for (let i = 0; i < items.length + 1; i++) {
                let changed = false;
                items.forEach(item => {
                    let minChildDepth = 99999;
                    let hasChild = false;
                    item.outputs.forEach(out => {
                        const dstItem = out.targetBlock;
                        if (dstItem) {
                            hasChild = true;
                            minChildDepth = Math.min(minChildDepth, nodeDepths[dstItem.id]);
                        }
                    });
                    if (hasChild && nodeDepths[item.id] < minChildDepth - 1) {
                        nodeDepths[item.id] = minChildDepth - 1;
                        changed = true;
                    }
                });
                if (!changed) break;
            }
        } else {
            // ALAP：向左逆向反推 (Sink-Aligned)
            for (let i = 0; i < items.length + 1; i++) {
                let changed = false;
                items.forEach(item => {
                    item.outputs.forEach(out => {
                        const dstItem = out.targetBlock;
                        if (dstItem && nodeDepths[item.id] <= nodeDepths[dstItem.id]) {
                            nodeDepths[item.id] = nodeDepths[dstItem.id] + 1;
                            changed = true;
                        }
                    });
                });
                if (!changed) break;
            }
            // Sink-Aligned 必需的矩阵翻转：保证终点对齐
            let maxDepth = 0;
            for (const id in nodeDepths) maxDepth = Math.max(maxDepth, nodeDepths[id]);
            for (const id in nodeDepths) nodeDepths[id] = maxDepth - nodeDepths[id];
        }

        // ======= 分列计算 =======
        const columns = {};
        const colMaxWidths = {};
        items.forEach(item => {
            const d = nodeDepths[item.id];
            if (!columns[d]) columns[d] = [];
            columns[d].push(item);
            colMaxWidths[d] = Math.max(colMaxWidths[d] || 0, item.size[0]);
        });

        // 决定物理绘制顺序
        const sortedDepths = Object.keys(columns).sort((a, b) => {
            return isReverse ? (parseInt(b) - parseInt(a)) : (parseInt(a) - parseInt(b));
        });

        let currentXBase = anchorX;
        let maxGroupY = startY;
        let totalGroupWidth = 0;

        // ======= 逐列对齐与排序 =======
        sortedDepths.forEach(depthStr => {
            const depth = parseInt(depthStr);
            const colItems = columns[depth];
            const colWidth = colMaxWidths[depth];
            totalGroupWidth += (colWidth + horizontalGap);

            const colLeftX = isReverse ? (currentXBase - colWidth) : currentXBase;

            colItems.sort((a, b) => {
                const getSortKey = (item) => {
                    let sumSlot = 0;
                    let count = 0;
                    let minParentY = 99999;

                    if (isReverse) {
                        item.outputs.forEach(out => {
                            const childItem = out.targetBlock;
                            if (childItem && nodeDepths[childItem.id] > depth) {
                                const cy = childItem._newPos ? childItem._newPos[1] : childItem.pos[1];
                                minParentY = Math.min(minParentY, cy);
                                sumSlot += out.target_slot || 0;
                                count++;
                            }
                        });
                    } else {
                        item.inputs.forEach(inp => {
                            const parentItem = inp.originBlock;
                            if (parentItem && nodeDepths[parentItem.id] < depth) {
                                const py = parentItem._newPos ? parentItem._newPos[1] : parentItem.pos[1];
                                minParentY = Math.min(minParentY, py);
                                sumSlot += inp.origin_slot || 0;
                                count++;
                            }
                        });
                    }

                    if (count === 0) return { y: item._newPos ? item._newPos[1] : item.pos[1], slot: 0 };
                    return { y: minParentY, slot: sumSlot / count };
                };
                
                const keyA = getSortKey(a);
                const keyB = getSortKey(b);

                if (Math.abs(keyA.y - keyB.y) > 10) return keyA.y - keyB.y;
                return keyA.slot - keyB.slot;
            });

            // ✨ 修改开始：这里使用安全的“天际线”游标
            let currentCursorY = startY;
            colItems.forEach(item => {
                let targetY = -1;
                const findTarget = () => {
                    let rel = [];
                    if (isReverse) {
                        item.outputs.forEach(out => {
                            const childItem = out.targetBlock;
                            if (childItem && nodeDepths[childItem.id] > depth) rel.push(childItem);
                        });
                    } else {
                        item.inputs.forEach(inp => {
                            const parentItem = inp.originBlock;
                            if (parentItem && nodeDepths[parentItem.id] < depth) rel.push(parentItem);
                        });
                    }
                    return rel.length === 1 ? rel[0] : null;
                };

                const tItem = findTarget();
                if (tItem) {
                    targetY = tItem._newPos ? tItem._newPos[1] : tItem.pos[1];
                }

                // ✨ 获取当前节点的标题栏高度（节点组的视觉顶部与主体对齐，高度为0）
                const itemTitleHeight = item.isGroup ? 0 : (item.entity.titleHeight || 30);
                
                // ✨ 为了保证标题栏不吃掉上一层的间距，当前节点主体的最小安全下放距离必须加上 titleHeight
                const minYForBody = currentCursorY + itemTitleHeight;

                // 判断是否跟目标对齐，且目标位置没有越过安全边界
                const finalY = (targetY !== -1 && targetY >= minYForBody) ? targetY : minYForBody;
                
                // 将新坐标缓存在 Block 上，等待递归函数负责真正的写入和平移
                item._newPos = [
                    isReverse ? (currentXBase - item.size[0]) : colLeftX,
                    finalY
                ];

                // 获取当前节点的物理底端坐标
                const itemBottom = finalY + item.size[1];

                // ✨ 计算下一个安全“天际线”游标：当前节点底部 + 要求的垂直间距
                currentCursorY = itemBottom + rowHeightGap;
                
                // ✨ 修复孤岛垂直间距累加问题：孤岛的最大高度只需要算到节点底部，不应包含末尾的垂直间距
                if (itemBottom > maxGroupY) maxGroupY = itemBottom;
            });
            // ✨ 修改结束

            currentXBase = isReverse ? (colLeftX - horizontalGap) : (colLeftX + colWidth + horizontalGap);
        });

        return {
            width: totalGroupWidth - horizontalGap,
            height: maxGroupY - startY
        };
    }
});