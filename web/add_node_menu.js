import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// 注入自定义 CSS 样式
const style = document.createElement("style");
style.textContent = `
    /* 全屏透明遮罩 */
    .add-node-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9998;
        background: transparent; 
    }

    /* 菜单容器 */
    .add-node-menu-container {
        position: fixed;
        background: rgba(30, 30, 30, 0.98); 
        border: 1px solid #444;
        border-radius: 4px;
        box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.5);
        color: #eee;
        font-family: sans-serif;
        font-size: 12.5px; 
        z-index: 9999;
        min-width: 160px; 
        width: max-content; 
        max-width: 400px;
        padding: 4px 0;
        user-select: none;
        backdrop-filter: blur(8px);
        opacity: 0; 
        transition: opacity 0.05s ease-in;
    }
    
    .add-node-menu-container.visible {
        opacity: 1;
    }

    /* 菜单项基础样式 */
    .add-node-menu-item {
        padding: 6px 12px; 
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.1s; 
        position: relative;
        border-left: 3px solid transparent; /* 预留给 Quick 标记的线条位置 */
    }

    /* 悬停状态 */
    .add-node-menu-item:hover, .add-node-menu-item.active {
        background: #2a60a8;
        color: white;
    }

    /* 置顶状态 (背景加深) */
    .add-node-menu-item.pinned {
        background-color: rgba(0, 0, 0, 0.4); 
    }
    .add-node-menu-item.pinned:hover, .add-node-menu-item.pinned.active {
        background: #2a60a8;
    }

    /* Quick 标记状态 (绿色) - 原收藏状态 */
    .add-node-menu-item.quick-marked {
        border-left: 3px solid #2ecc71; 
        background-color: rgba(46, 204, 113, 0.05); 
    }

    /* 箭头 */
    .add-node-menu-arrow {
        font-size: 9px;
        margin-left: 10px;
        opacity: 0.6;
    }

    /* 分割线 */
    .add-node-menu-separator {
        height: 1px;
        background-color: rgba(255, 255, 255, 0.15); 
        margin: 4px 0; 
        width: 100%;
        transform: scaleY(0.5); 
    }
    
    /* 拖拽指示器 - 顶部边缘 */
    .add-node-menu-container.drag-over-header {
        border-top: 2px solid #4a90e2; 
    }

    /* 拖拽相关样式 */
    .add-node-menu-item.dragging {
        opacity: 0.5;
        background: #444;
    }
    .add-node-menu-item.drag-over-top {
        border-top: 2px solid #4a90e2;
    }
    .add-node-menu-item.drag-over-bottom {
        border-bottom: 2px solid #4a90e2;
    }
    .add-node-menu-item.drag-over-unpin {
        opacity: 0.7;
        background: rgba(200, 50, 50, 0.2); 
    }

    /* 右键菜单 */
    .add-node-menu-context {
        position: fixed;
        background: rgba(35, 35, 35, 0.98);
        border: 1px solid #555;
        border-radius: 4px;
        box-shadow: 2px 2px 8px rgba(0,0,0,0.6);
        z-index: 10000;
        padding: 4px 0;
        min-width: 120px;
        color: #ddd;
        font-size: 12px;
        font-family: sans-serif;
        backdrop-filter: blur(5px);
    }
    .add-node-menu-context-item {
        padding: 6px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    .add-node-menu-context-item:hover {
        background: #2a60a8;
        color: white;
    }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "Comfy.AddNodeMenu", 
    
    setup() {
        // --- 核心变量 ---
        let menuStack = []; 
        let overlay = null;
        let contextMenuEl = null; 
        let hoverTimer = null; 
        let globalMouse = { x: 0, y: 0 };
        let lockedCanvasPos = { x: 0, y: 0 };
        
        let dragSource = null; 
        
        // --- 缓存数据 ---
        let cachedData = {
            pins: {},      
            quick: [], // 原 favorites 改为 quick
            last_category: null
        };
        
        const UNCATEGORIZED_NAME = "Others";
        // 特殊键：用于存储所有被置顶的“节点”的类名 (Class Name)
        // 这样无论节点在哪个文件夹显示，或者显示名称是什么语言，都能被识别
        const GLOBAL_NODE_PINS_KEY = "__ALL_NODES__";

        const PRIMARY_CATEGORIES = [
            "utils", "sampling", "采样", "loaders", "加载器",
            "latent", "Latent", "_for_testing", "_用于测试",
            "advanced", "高级", "mask", "遮罩",
            "image", "图像", "api node", "工具", "api", "api 节点", "API"
        ];

        window.addEventListener("mousemove", (e) => {
            globalMouse.x = e.clientX;
            globalMouse.y = e.clientY;
        });

        // --- API 交互 ---
        async function fetchData() {
            try {
                const res = await api.fetchApi("/align-layout/data");
                const data = await res.json();
                if (data) {
                    cachedData = data;
                    if (!cachedData.pins) cachedData.pins = {};
                    if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
                }
            } catch (e) { console.error("[AddNodeMenu] Load failed", e); }
        }

        async function savePins(pinsData) {
            try {
                await api.fetchApi("/align-layout/pins", {
                    method: "POST",
                    body: JSON.stringify(pinsData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { console.error("Save pins failed", e); }
        }

        async function saveQuick(quickData) { 
            try {
                await api.fetchApi("/align-layout/quick", {
                    method: "POST",
                    body: JSON.stringify(quickData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { console.error("Save quick failed", e); }
        }

        async function saveLastCategory(categoryData) {
            try {
                await api.fetchApi("/align-layout/last_category", {
                    method: "POST",
                    body: JSON.stringify(categoryData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { console.error("Save last category failed", e); }
        }

        // --- 核心逻辑函数 (修复版) ---

        // 获取当前文件夹下的本地置顶列表 (用于文件夹)
        function getLocalPinnedList(parentPath) {
            if (!cachedData.pins) cachedData.pins = {};
            return cachedData.pins[parentPath] || [];
        }

        // 获取全局节点置顶列表 (用于节点，跨语言)
        function getGlobalNodePinnedList() {
            if (!cachedData.pins) cachedData.pins = {};
            if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
            return cachedData.pins[GLOBAL_NODE_PINS_KEY];
        }

        // 判断是否置顶
        // key: 显示名称 (对于文件夹必须用这个)
        // type: 节点类名 (对于节点必须用这个)
        // isCategory: 是否是文件夹
        function isPinned(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                // 如果是节点，检查全局类名列表
                const globalList = getGlobalNodePinnedList();
                return globalList.includes(type);
            } else {
                // 如果是文件夹，检查本地路径列表
                const localList = getLocalPinnedList(parentPath);
                return localList.includes(key);
            }
        }

        // 切换置顶状态
        function togglePin(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                // --- 节点逻辑：操作全局列表 ---
                const list = getGlobalNodePinnedList();
                const idx = list.indexOf(type);
                if (idx === -1) {
                    list.push(type);
                } else {
                    list.splice(idx, 1);
                }
                savePins(cachedData.pins);
            } else {
                // --- 文件夹逻辑：操作本地列表 ---
                if (!cachedData.pins[parentPath]) cachedData.pins[parentPath] = [];
                const list = cachedData.pins[parentPath];
                const idx = list.indexOf(key);
                if (idx === -1) {
                    list.push(key); 
                } else {
                    list.splice(idx, 1);
                }
                savePins(cachedData.pins);
            }
        }

        // 更新置顶顺序 (拖拽用)
        function updatePinOrder(parentPath, key, isCategory, type, targetIndex) {
            let list;
            let itemKey;

            if (!isCategory && type) {
                // 节点：在全局列表中移动
                list = getGlobalNodePinnedList();
                itemKey = type;
            } else {
                // 文件夹：在本地列表中移动
                if (!cachedData.pins[parentPath]) cachedData.pins[parentPath] = [];
                list = cachedData.pins[parentPath];
                itemKey = key;
            }

            const oldIndex = list.indexOf(itemKey);
            if (oldIndex !== -1) {
                list.splice(oldIndex, 1);
                if (targetIndex > oldIndex) {
                    targetIndex--;
                }
            }
            
            if (targetIndex < 0) targetIndex = 0;
            if (targetIndex > list.length) targetIndex = list.length;
            
            list.splice(targetIndex, 0, itemKey);
            savePins(cachedData.pins);
        }

        // 移除置顶
        function removePin(parentPath, key, isCategory, type) {
            let list;
            let itemKey;

            if (!isCategory && type) {
                list = getGlobalNodePinnedList();
                itemKey = type;
            } else {
                if (!cachedData.pins[parentPath]) return;
                list = cachedData.pins[parentPath];
                itemKey = key;
            }

            const idx = list.indexOf(itemKey);
            if (idx !== -1) {
                list.splice(idx, 1);
                savePins(cachedData.pins);
            }
        }
        
        // 收藏检查 (已修复：节点使用 type 比较，不再依赖显示名称)
        function isQuick(quickObj) {
            if (!cachedData.quick) return false;
            return cachedData.quick.some(f => {
                if (f.isCategory && quickObj.isCategory) {
                    return f.category === quickObj.category; 
                }
                if (!f.isCategory && !quickObj.isCategory) {
                    // 节点仅仅比较 type (类名)，这是跨语言唯一的
                    return f.type === quickObj.type; 
                }
                return false;
            });
        }

        function addQuick(quickObj) {
            if (!cachedData.quick) cachedData.quick = [];
            const exists = isQuick(quickObj);
            if (!exists) {
                // 仅保存核心标识符，不再保存 title，避免语言切换导致的旧名称残留
                // 渲染时会根据 type 动态获取当前的 title
                cachedData.quick.push({
                    type: quickObj.type,   // 核心标识符
                    category: quickObj.category, 
                    isCategory: quickObj.isCategory,
                    timestamp: Date.now()
                });
                saveQuick(cachedData.quick);
            }
        }
        
        function removeQuick(quickObj) {
             if (!cachedData.quick) return;
             const idx = cachedData.quick.findIndex(f => {
                if (f.isCategory && quickObj.isCategory) {
                    return f.category === quickObj.category;
                }
                if (!f.isCategory && !quickObj.isCategory) {
                    return f.type === quickObj.type;
                }
                return false;
             });
             if (idx !== -1) {
                 cachedData.quick.splice(idx, 1);
                 saveQuick(cachedData.quick);
             }
        }

        function updateLastCategory(key) {
            if (cachedData.last_category === key) return;
            cachedData.last_category = key;
            saveLastCategory(key);
        }

        function buildNodeTree() {
            const tree = {};
            const registered = LiteGraph.registered_node_types;

            for (const className in registered) {
                const nodeData = registered[className];
                if (nodeData.hidden) continue;

                const category = nodeData.category || UNCATEGORIZED_NAME;
                const parts = category.split('/');
                
                let currentLevel = tree;
                for (const part of parts) {
                    if (!currentLevel[part]) {
                        currentLevel[part] = { _isCategory: true, _children: {} };
                    }
                    currentLevel = currentLevel[part]._children;
                }
                
                const displayName = nodeData.title || nodeData.name || className;
                currentLevel[displayName] = { 
                    _isCategory: false, 
                    type: className, // 这是一个重要的稳定 ID
                    title: displayName,
                    category: category 
                };
            }
            return tree;
        }

        function closeAll() {
            menuStack.forEach(el => el.remove());
            menuStack = [];
            closeContextMenu();
            if (overlay) {
                overlay.remove();
                overlay = null;
            }
        }

        function closeContextMenu() {
            if (contextMenuEl) {
                contextMenuEl.remove();
                contextMenuEl = null;
            }
        }

        function closeLevelsAfter(levelIndex) {
            while (menuStack.length > levelIndex + 1) {
                const menu = menuStack.pop();
                menu.remove();
            }
        }

        function attachScrollHandler(container) {
            container.addEventListener("wheel", (e) => {
                const rect = container.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                e.preventDefault();
                e.stopPropagation();

                const currentTop = parseFloat(container.style.top) || 0;
                const delta = e.deltaY; 
                let newTop = currentTop - delta;
                const maxTop = viewportHeight - 50; 
                const minTop = 50 - rect.height;

                if (newTop > maxTop) newTop = maxTop;
                if (newTop < minTop) newTop = minTop;

                container.style.top = `${newTop}px`;
                const levelIndex = menuStack.indexOf(container);
                if (levelIndex !== -1) {
                    closeLevelsAfter(levelIndex);
                    closeContextMenu(); 
                    const items = container.querySelectorAll('.add-node-menu-item'); 
                    items.forEach(i => i.classList.remove('active'));
                }
            }, { passive: false });
        }

        function getPrimaryIndex(key) {
            return PRIMARY_CATEGORIES.findIndex(p => p.toLowerCase() === key.toLowerCase());
        }

        // 修改后的排序逻辑：同时支持本地文件夹置顶和全局节点置顶
        function sortWithPins(keys, parentPath, structure, defaultSortFn) {
            const localPins = getLocalPinnedList(parentPath);
            const globalNodePins = getGlobalNodePinnedList();

            const pinned = [];
            const unpinned = [];
            
            keys.forEach(k => {
                const item = structure[k];
                let isP = false;
                
                if (item && !item._isCategory && item.type) {
                    // 如果是节点，检查全局列表
                    if (globalNodePins.includes(item.type)) isP = true;
                } else {
                    // 如果是文件夹，检查本地列表
                    if (localPins.includes(k)) isP = true;
                }

                if (isP) pinned.push(k);
                else unpinned.push(k);
            });
            
            // 置顶项排序
            pinned.sort((a, b) => {
                // 计算权重：越小越靠前
                // 全局置顶节点：权重 = 0 ~ N (按照置顶顺序)
                // 本地置顶文件夹：权重 = 10000 ~ 10000+N (排在节点之后，或者你可以反过来)
                // 这里我们设定：谁在各自的列表中索引小，谁就靠前。
                // 如果一个是节点一个是文件夹，我们让节点靠前 (可调整)
                
                const itemA = structure[a];
                const itemB = structure[b];
                
                let scoreA = 999999;
                let scoreB = 999999;

                if (itemA && !itemA._isCategory && itemA.type && globalNodePins.includes(itemA.type)) {
                    scoreA = globalNodePins.indexOf(itemA.type);
                } else if (localPins.includes(a)) {
                    scoreA = 100000 + localPins.indexOf(a);
                }

                if (itemB && !itemB._isCategory && itemB.type && globalNodePins.includes(itemB.type)) {
                    scoreB = globalNodePins.indexOf(itemB.type);
                } else if (localPins.includes(b)) {
                    scoreB = 100000 + localPins.indexOf(b);
                }

                return scoreA - scoreB;
            });

            unpinned.sort((a, b) => defaultSortFn(a, b, structure));

            return [...pinned, ...unpinned];
        }

        function defaultSort(a, b, structure) {
            const isCatA = structure[a]._isCategory;
            const isCatB = structure[b]._isCategory;
            if (isCatA && !isCatB) return -1;
            if (!isCatA && isCatB) return 1;
            return a.localeCompare(b);
        }

        function refreshMenu(container) {
            if (!container || !container._menuArgs) return;
            const { structure, levelIndex, parentPath } = container._menuArgs;
            const scrollTop = container.scrollTop;
            renderMenuContent(container, structure, levelIndex, parentPath);
            container.scrollTop = scrollTop;
        }

        function showContextMenu(e, parentPath, key, itemData, quickObj, container) {
            e.preventDefault();
            e.stopPropagation();
            closeContextMenu();

            const menu = document.createElement("div");
            menu.className = "add-node-menu-context"; 
            
            const isCategory = itemData._isCategory;
            const type = itemData.type; // 节点的类名
            
            const pinned = isPinned(parentPath, key, isCategory, type);
            const isMarked = isQuick(quickObj);
            
            const pinItem = document.createElement("div");
            pinItem.className = "add-node-menu-context-item"; 
            pinItem.innerHTML = pinned ? "取消置顶 (Unpin)" : "置顶 (Pin)";
            pinItem.onclick = (ev) => {
                ev.stopPropagation();
                togglePin(parentPath, key, isCategory, type);
                closeContextMenu(); 
                refreshMenu(container); 
            };
            menu.appendChild(pinItem);

            const quickItem = document.createElement("div");
            quickItem.className = "add-node-menu-context-item"; 
            quickItem.innerHTML = isMarked ? "取消收藏 (Unfavorite)" : "收藏 (Favorite)";
            quickItem.onclick = (ev) => {
                ev.stopPropagation();
                if (isMarked) {
                    removeQuick(quickObj);
                } else {
                    addQuick(quickObj);
                }
                closeContextMenu(); 
                refreshMenu(container); 
            };
            menu.appendChild(quickItem);

            document.body.appendChild(menu);
            contextMenuEl = menu;

            let x = e.clientX;
            let y = e.clientY;
            const rect = menu.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x -= rect.width;
            if (y + rect.height > window.innerHeight) y -= rect.height;
            menu.style.left = x + "px";
            menu.style.top = y + "px";
        }

        // --- 核心渲染逻辑 ---
        function renderMenuContent(container, structure, levelIndex, parentPath) {
            container.innerHTML = ''; 

            let allKeys = Object.keys(structure);
            let finalKeys = [];

            if (levelIndex === 0) {
                const systemPrimaryGroup = [];
                const middleGroup = [];
                const tailGroup = [];

                allKeys.forEach(key => {
                    if (key === UNCATEGORIZED_NAME) {
                        tailGroup.push(key);
                    } else if (getPrimaryIndex(key) !== -1) {
                        systemPrimaryGroup.push(key);
                    } else {
                        middleGroup.push(key);
                    }
                });

                const primarySortFn = (a, b) => getPrimaryIndex(a) - getPrimaryIndex(b);
                const sortedPrimary = sortWithPins(systemPrimaryGroup, parentPath, structure, (a, b) => primarySortFn(a, b));
                const sortedMiddle = sortWithPins(middleGroup, parentPath, structure, defaultSort);
                const sortedTail = sortWithPins(tailGroup, parentPath, structure, defaultSort);

                if (sortedPrimary.length > 0) finalKeys.push(...sortedPrimary);
                if (sortedMiddle.length > 0) {
                    if (finalKeys.length > 0) finalKeys.push("---SEPARATOR---");
                    finalKeys.push(...sortedMiddle);
                }
                if (sortedTail.length > 0) {
                    if (finalKeys.length > 0) finalKeys.push("---SEPARATOR---");
                    finalKeys.push(...sortedTail);
                }
            } else {
                finalKeys = sortWithPins(allKeys, parentPath, structure, defaultSort);
            }

            // 计算当前视图中置顶项目的数量 (用于判断拖拽行为)
            let pinnedCount = 0;
            finalKeys.forEach(k => {
                if (k === "---SEPARATOR---") return;
                const d = structure[k];
                if (isPinned(parentPath, k, d._isCategory, d.type)) pinnedCount++;
            });

            container.ondragover = (e) => {
                // 只有当没有任何置顶项时，才允许拖拽到 Header 触发 "置顶到第一位"
                // 且源必须匹配当前文件夹
                if (dragSource && dragSource.parentPath === parentPath && !dragSource.isPinned && pinnedCount === 0) {
                    // 如果是节点，parentPath 不重要，重要的是它是否已经在 global pin 中。
                    // 但为了 UI 交互一致，我们仍然限制在当前文件夹内操作。
                    e.preventDefault();
                    const rect = container.getBoundingClientRect();
                    if (e.clientY - rect.top < 30) { 
                        container.classList.add('drag-over-header');
                    } else {
                        container.classList.remove('drag-over-header');
                    }
                }
            };
            container.ondragleave = (e) => {
                 if (e.relatedTarget && !container.contains(e.relatedTarget)) {
                    container.classList.remove('drag-over-header');
                 }
            };
            container.ondrop = (e) => {
                if (dragSource && dragSource.parentPath === parentPath && !dragSource.isPinned && pinnedCount === 0) {
                     const rect = container.getBoundingClientRect();
                     if (e.clientY - rect.top < 30) {
                         e.preventDefault();
                         updatePinOrder(parentPath, dragSource.key, dragSource.isCategory, dragSource.type, 0); 
                         refreshMenu(container); 
                     }
                }
                 container.classList.remove('drag-over-header');
            };

            finalKeys.forEach((key, index) => {
                if (key === "---SEPARATOR---") {
                    const sep = document.createElement("div");
                    sep.className = "add-node-menu-separator"; 
                    sep.dataset.isSeparator = "true";
                    
                    sep.ondragover = (e) => {
                         e.preventDefault();
                         if (dragSource && dragSource.parentPath === parentPath) {
                             sep.style.background = "#4a90e2";
                             sep.style.height = "2px";
                         }
                    };
                    sep.ondragleave = (e) => {
                         sep.style.background = "";
                         sep.style.height = "";
                         sep.classList.remove('drag-over-top'); 
                         sep.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                         sep.style.transform = "scaleY(0.5)";
                    };
                    sep.ondrop = (e) => {
                        e.preventDefault();
                        if (dragSource && dragSource.parentPath === parentPath) {
                             // 计算目标索引
                             // 简单处理：如果是置顶区域，我们假设所有的 separator 都在置顶区下面是不可能的
                             // 实际上 separator 只在 root 出现。
                             // 我们简单地认为用户想置顶。
                             const targetIndex = pinnedCount; // 放到所有置顶项的后面
                             updatePinOrder(parentPath, dragSource.key, dragSource.isCategory, dragSource.type, targetIndex);
                             refreshMenu(container); 
                        }
                    };
                    
                    container.appendChild(sep);
                    return;
                }

                if (!structure[key]) return;

                const itemData = structure[key];
                const itemDiv = document.createElement("div");
                itemDiv.className = "add-node-menu-item"; 
                
                // 构造 Quick 对象
                const quickObj = itemData._isCategory
                    ? { 
                        title: key, 
                        type: "CATEGORY", 
                        isCategory: true,
                        category: (parentPath === "root" ? key : parentPath + "/" + key)
                      }
                    : { 
                        title: itemData.title, 
                        type: itemData.type, // 确保有 type
                        isCategory: false,
                        category: itemData.category 
                      };
                
                const isItemPinned = isPinned(parentPath, key, itemData._isCategory, itemData.type);
                const isItemMarked = isQuick(quickObj); 

                if (isItemPinned) itemDiv.classList.add("pinned");
                if (isItemMarked) itemDiv.classList.add("quick-marked"); 

                if (levelIndex === 0) itemDiv.dataset.key = key; 

                const contentWrapper = document.createElement("div");
                contentWrapper.style.display = "flex";
                contentWrapper.style.alignItems = "center";
                
                const textSpan = document.createElement("span");
                textSpan.textContent = key;
                contentWrapper.appendChild(textSpan);
                itemDiv.appendChild(contentWrapper);

                if (itemData._isCategory) {
                    const arrow = document.createElement("span");
                    arrow.className = "add-node-menu-arrow"; 
                    arrow.textContent = "▶";
                    itemDiv.appendChild(arrow);
                }

                itemDiv.draggable = true;
                itemDiv.ondragstart = (e) => {
                    // 记录拖拽源的重要信息：key, type, 是否置顶
                    let currentPinIndex = -1;
                    if (isItemPinned) {
                         if (!itemData._isCategory && itemData.type) {
                             currentPinIndex = getGlobalNodePinnedList().indexOf(itemData.type);
                         } else {
                             currentPinIndex = getLocalPinnedList(parentPath).indexOf(key);
                         }
                    }

                    dragSource = {
                        key: key, // 显示名
                        type: itemData.type, // 类名 (关键)
                        isCategory: itemData._isCategory,
                        parentPath: parentPath,
                        isPinned: isItemPinned,
                        index: currentPinIndex
                    };
                    itemDiv.classList.add("dragging");
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", key); 
                };

                itemDiv.ondragend = (e) => {
                    itemDiv.classList.remove("dragging");
                    dragSource = null;
                };

                itemDiv.ondragover = (e) => {
                    if (!dragSource || dragSource.parentPath !== parentPath) return;
                    e.preventDefault(); 

                    const rect = itemDiv.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const isTopHalf = offsetY < rect.height / 2;

                    itemDiv.classList.remove("drag-over-top", "drag-over-bottom", "drag-over-unpin");

                    if (isItemPinned) {
                        // 目标是置顶项：我们在调整顺序
                        if (isTopHalf) itemDiv.classList.add("drag-over-top");
                        else itemDiv.classList.add("drag-over-bottom");
                    } else {
                        // 目标是非置顶项：
                        if (dragSource.isPinned) {
                            // 源是置顶项 -> 意图是取消置顶
                            itemDiv.classList.add("drag-over-unpin");
                        }
                    }
                };

                itemDiv.ondragleave = (e) => {
                    itemDiv.classList.remove("drag-over-top", "drag-over-bottom", "drag-over-unpin");
                };

                itemDiv.ondrop = (e) => {
                    if (!dragSource || dragSource.parentPath !== parentPath) return;
                    e.preventDefault();
                    
                    const rect = itemDiv.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const isTopHalf = offsetY < rect.height / 2;

                    if (isItemPinned) {
                        // 目标是置顶项：我们在置顶区内排序
                        let targetPinIndex = -1;
                        if (!itemData._isCategory && itemData.type) {
                            targetPinIndex = getGlobalNodePinnedList().indexOf(itemData.type);
                        } else {
                            targetPinIndex = getLocalPinnedList(parentPath).indexOf(key);
                        }

                        if (!isTopHalf) targetPinIndex += 1; 
                        
                        // 注意：我们只允许同类型的排序互相影响 (节点 vs 节点)，否则逻辑太复杂
                        // 但 updatePinOrder 内部已经做了区分
                        updatePinOrder(parentPath, dragSource.key, dragSource.isCategory, dragSource.type, targetPinIndex);
                        refreshMenu(container); 
                    } 
                    else {
                        // 目标是普通项
                        if (dragSource.isPinned) {
                            // 取消置顶
                            removePin(parentPath, dragSource.key, dragSource.isCategory, dragSource.type);
                            refreshMenu(container); 
                        } 
                    }
                };

                if (itemData._isCategory) {
                    const nextPath = parentPath === "root" ? key : (parentPath + "/" + key);
                    const activateSubmenu = () => {
                        if (levelIndex === 0) updateLastCategory(key);
                        const siblings = container.querySelectorAll('.add-node-menu-item'); 
                        siblings.forEach(s => s.classList.remove('active'));
                        itemDiv.classList.add('active');
                        if (hoverTimer) clearTimeout(hoverTimer);
                        hoverTimer = setTimeout(() => {
                            closeLevelsAfter(levelIndex); 
                            closeContextMenu();
                            const rect = itemDiv.getBoundingClientRect();
                            let subX = rect.right - 1; 
                            let subY = rect.top;
                            const subMenuEl = showMenu(itemData._children, subX, subY, levelIndex + 1, nextPath);
                            subMenuEl.classList.add('visible'); 
                            const subRect = subMenuEl.getBoundingClientRect();
                            if (subRect.right > window.innerWidth) subMenuEl.style.left = (rect.left - subRect.width + 1) + "px";
                            if (subRect.height > window.innerHeight) subMenuEl.style.top = "10px";
                            else if (subRect.bottom > window.innerHeight) subMenuEl.style.top = Math.max(0, window.innerHeight - subRect.height - 10) + "px";
                        }, 40); 
                    };
                    itemDiv.addEventListener("mouseenter", activateSubmenu);
                    itemDiv.addEventListener("click", (e) => { e.stopPropagation(); activateSubmenu(); });
                } else {
                    itemDiv.addEventListener("click", () => {
                        addNode(itemData.type);
                        closeAll();
                    });
                    itemDiv.addEventListener("mouseenter", () => {
                        const siblings = container.querySelectorAll('.add-node-menu-item'); 
                        siblings.forEach(s => s.classList.remove('active'));
                        itemDiv.classList.add('active');
                        if (hoverTimer) clearTimeout(hoverTimer);
                        hoverTimer = setTimeout(() => { closeLevelsAfter(levelIndex); }, 40);
                    });
                }
                itemDiv.addEventListener("contextmenu", (e) => {
                    showContextMenu(e, parentPath, key, itemData, quickObj, container);
                });
                container.appendChild(itemDiv);
            });
        }

        function showMenu(structure, x, y, levelIndex, parentPath = "root") {
            const container = document.createElement("div");
            container.className = "add-node-menu-container"; 
            
            // 存储参数以便刷新
            container._menuArgs = { structure, levelIndex, parentPath };
            
            // 初始渲染
            renderMenuContent(container, structure, levelIndex, parentPath);

            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
            attachScrollHandler(container);
            document.body.appendChild(container);
            
            if (menuStack.length > levelIndex) {
                menuStack = menuStack.slice(0, levelIndex);
            }
            menuStack.push(container);

            return container;
        }

        function addNode(type) {
             const name = type;
             const node = LiteGraph.createNode(name);
             if (node) {
                 node.pos = [lockedCanvasPos.x, lockedCanvasPos.y];
                 app.graph.add(node);
                 app.canvas.selectNode(node);
             }
        }

        function initMenu() {
            closeAll(); 
            fetchData();

            const screenX = globalMouse.x;
            const screenY = globalMouse.y;

            overlay = document.createElement("div");
            overlay.className = "add-node-menu-overlay"; 
            overlay.onclick = (e) => { e.stopPropagation(); e.preventDefault(); closeAll(); };
            overlay.addEventListener("mousedown", (e) => { closeAll(); });
            overlay.addEventListener("contextmenu", (e) => { e.preventDefault(); closeAll(); });
            document.body.appendChild(overlay);

            const tree = buildNodeTree();
            const rootMenu = showMenu(tree, 0, 0, 0, "root"); 

            const lastCategory = cachedData.last_category;
            let targetOffsetY = 0;
            let targetOffsetX = 0;
            const rect = rootMenu.getBoundingClientRect();
            let targetEl = null;
            if (lastCategory) targetEl = rootMenu.querySelector(`.add-node-menu-item[data-key="${lastCategory}"]`); 

            if (targetEl) {
                targetOffsetY = targetEl.offsetTop + (targetEl.offsetHeight / 2);
                targetOffsetX = targetEl.offsetLeft + (targetEl.offsetWidth / 2);
            } else {
                targetOffsetY = rect.height / 2;
                targetOffsetX = rect.width / 2;
            }

            let finalTop = screenY - targetOffsetY;
            let finalLeft = screenX - targetOffsetX;
            if (finalLeft < 10) finalLeft = 10;
            if (finalLeft + rect.width > window.innerWidth - 10) finalLeft = window.innerWidth - rect.width - 10;
            if (targetEl) {
                const maxTop = window.innerHeight - 50;
                const minTop = 50 - rect.height;
                if (finalTop > maxTop) finalTop = maxTop;
                if (finalTop < minTop) finalTop = minTop;
            } else {
                if (finalTop < 10) finalTop = 10;
                if (finalTop + rect.height > window.innerHeight - 10) {
                    finalTop = window.innerHeight - rect.height - 10;
                    if (finalTop < 10) finalTop = 10; 
                }
            }
            rootMenu.style.top = `${finalTop}px`;
            rootMenu.style.left = `${finalLeft}px`;
            requestAnimationFrame(() => { rootMenu.classList.add('visible'); });
        }

        fetchData();

        window.addEventListener("keydown", function(e) {
            if (e.key.toLowerCase() === "a") {
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
                if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
                
                // --- 新增互斥逻辑 ---
                // 检查 Quick Node Menu 的遮罩层是否存在，如果存在则模拟点击关闭它
                // 修改：匹配 quick_node_menu.js 中定义的类名 .quick-menu-overlay
                const quickOverlay = document.querySelector(".quick-menu-overlay");
                if (quickOverlay) {
                    quickOverlay.click();
                }
                // ------------------

                lockedCanvasPos.x = app.canvas.graph_mouse[0];
                lockedCanvasPos.y = app.canvas.graph_mouse[1];
                initMenu();
            }
            if (e.key === "Escape") closeAll();
        });
    }
});