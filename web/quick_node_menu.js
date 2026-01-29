import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// 注入自定义 CSS 样式 (使用 quick-menu- 前缀以防冲突)
// 使用 CSS 变量来支持动态颜色设置
const style = document.createElement("style");
style.textContent = `
    /* 全屏透明遮罩 */
    .quick-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9998;
        background: transparent; 
    }

    /* 菜单容器 */
    .quick-menu-container {
        position: fixed;
        background: rgba(30, 30, 30, 0.98); /* 默认值，会被JS覆盖 */
        border: 1px solid #555;
        border-radius: 4px;
        box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.5);
        color: #eee;
        font-family: sans-serif;
        font-size: 12.5px; /* 默认值，会被JS覆盖 */
        z-index: 9999;
        min-width: 160px; 
        width: max-content; 
        max-width: 400px; /* 默认值，会被JS覆盖 */
        padding: 4px 0;
        user-select: none;
        backdrop-filter: var(--qnm-blur, blur(8px)); /* 动态毛玻璃 */
        opacity: 0; 
        transition: opacity 0.05s ease-in;
    }
    
    .quick-menu-container.visible {
        opacity: 1;
    }

    /* 菜单项基础样式 */
    .quick-menu-item {
        padding: 6px 12px; 
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.1s; 
        position: relative;
    }

    /* 悬停状态 - 使用稍不同的颜色 (紫色系) 以区分 Quick Menu */
    .quick-menu-item:hover, .quick-menu-item.active {
        background: var(--qnm-hover-bg, #6c5ce7); 
        color: white;
    }

    /* 置顶状态 */
    .quick-menu-item.pinned {
        background-color: rgba(0, 0, 0, 0.4); 
    }
    .quick-menu-item.pinned:hover, .quick-menu-item.pinned.active {
        background: var(--qnm-hover-bg, #6c5ce7);
    }

    /* 箭头 */
    .quick-menu-arrow {
        font-size: 9px;
        margin-left: 10px;
        opacity: 0.6;
    }

    /* 分割线 */
    .quick-menu-separator {
        height: 1px;
        background-color: rgba(255, 255, 255, 0.15); 
        margin: 4px 0; 
        width: 100%;
        transform: scaleY(0.5); 
    }
    
    /* 拖拽相关样式 */
    .quick-menu-container.drag-over-header {
        border-top: 2px solid #a29bfe; 
    }
    .quick-menu-item.dragging {
        opacity: 0.5;
        background: #444;
    }
    .quick-menu-item.drag-over-top {
        border-top: 2px solid #a29bfe;
    }
    .quick-menu-item.drag-over-bottom {
        border-bottom: 2px solid #a29bfe;
    }
    .quick-menu-item.drag-over-unpin {
        opacity: 0.7;
        background: rgba(200, 50, 50, 0.2); 
    }

    /* 右键菜单 */
    .quick-menu-context {
        position: fixed;
        background: rgba(35, 35, 35, 0.98);
        border: 1px solid #666;
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
    .quick-menu-context-item {
        padding: 6px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    .quick-menu-context-item:hover {
        background: #e74c3c; /* 红色表示移除操作，保持默认 */
        color: white;
    }
    .quick-menu-context-item.pin-option:hover {
        background: var(--qnm-hover-bg, #6c5ce7); /* 普通操作颜色跟随主题 */
    }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "Comfy.QuickNodeMenu", // 独立名称
    
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
            quick_list: [],     // 对应 add_node_menu_quick.json 的内容
            pins: {},           // Quick Menu 自己的 pins (quick_menu_pins.json)
            last_category: null // Quick Menu 自己的 last_category
        };
        
        // 特殊键：用于存储所有被置顶的“节点”的类名 (Class Name)
        const GLOBAL_NODE_PINS_KEY = "__ALL_NODES__";

        window.addEventListener("mousemove", (e) => {
            globalMouse.x = e.clientX;
            globalMouse.y = e.clientY;
        });

        // --- API 交互 ---
        async function fetchData() {
            try {
                const res = await api.fetchApi("/quick-menu/data");
                const data = await res.json();
                if (data) {
                    cachedData = data;
                    if (!cachedData.pins) cachedData.pins = {};
                    if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
                }
            } catch (e) { console.error("[QuickNodeMenu] Load failed", e); }
        }

        async function savePins(pinsData) {
            try {
                await api.fetchApi("/quick-menu/pins", {
                    method: "POST",
                    body: JSON.stringify(pinsData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { console.error("Save quick pins failed", e); }
        }

        async function saveSharedList(newList) {
            try {
                await api.fetchApi("/quick-menu/update_list", {
                    method: "POST",
                    body: JSON.stringify(newList),
                    headers: { "Content-Type": "application/json" }
                });
                cachedData.quick_list = newList; // 本地同步更新
            } catch (e) { console.error("Save shared list failed", e); }
        }

        async function saveLastCategory(categoryData) {
            try {
                await api.fetchApi("/quick-menu/last_category", {
                    method: "POST",
                    body: JSON.stringify(categoryData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { console.error("Save quick last category failed", e); }
        }

        // --- 辅助函数：颜色处理 ---
        function normalizeColor(input) {
            if (!input) return null;
            let color = input.trim();
            // 处理 0x 前缀
            if (color.startsWith("0x") || color.startsWith("0X")) {
                color = "#" + color.substring(2);
            }
            // 处理无前缀
            if (!color.startsWith("#")) {
                color = "#" + color;
            }
            // 简单验证 Hex 格式
            if (/^#[0-9A-Fa-f]{6}$/.test(color) || /^#[0-9A-Fa-f]{3}$/.test(color)) {
                return color;
            }
            return null;
        }

        // --- 辅助函数：快捷键匹配 ---
        function matchShortcut(e, shortcutStr) {
            if (!shortcutStr) return false;
            const parts = shortcutStr.split('+').map(s => s.trim().toLowerCase());
            let key = parts.pop();
            
            // 处理特殊键名
            if (key === "space") key = " ";
            
            if (e.key.toLowerCase() !== key) return false;
            
            const ctrl = parts.includes("ctrl");
            const alt = parts.includes("alt");
            const shift = parts.includes("shift");
            const meta = parts.includes("meta") || parts.includes("cmd");
            
            // 严格匹配修饰键
            if (e.ctrlKey !== ctrl) return false;
            if (e.altKey !== alt) return false;
            if (e.shiftKey !== shift) return false;
            if (e.metaKey !== meta) return false;
            
            return true;
        }

        // --- 核心逻辑函数 (适配新逻辑) ---

        // 获取 Quick Menu 本地的文件夹置顶列表
        function getLocalPinnedList(parentPath) {
            if (!cachedData.pins) cachedData.pins = {};
            return cachedData.pins[parentPath] || [];
        }

        // 获取 Quick Menu 的全局节点置顶列表
        function getGlobalNodePinnedList() {
            if (!cachedData.pins) cachedData.pins = {};
            if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
            return cachedData.pins[GLOBAL_NODE_PINS_KEY];
        }

        // 判断是否置顶
        function isPinned(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                // 节点：检查全局类名列表
                const globalList = getGlobalNodePinnedList();
                return globalList.includes(type);
            } else {
                // 文件夹：检查本地路径列表
                const localList = getLocalPinnedList(parentPath);
                return localList.includes(key);
            }
        }

        // 切换置顶
        function togglePin(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                // --- 节点逻辑 ---
                const list = getGlobalNodePinnedList();
                const idx = list.indexOf(type);
                if (idx === -1) {
                    list.push(type); 
                } else {
                    list.splice(idx, 1);
                }
                savePins(cachedData.pins);
            } else {
                // --- 文件夹逻辑 ---
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

        // 更新置顶顺序
        function updatePinOrder(parentPath, key, isCategory, type, targetIndex) {
            let list;
            let itemKey;

            if (!isCategory && type) {
                list = getGlobalNodePinnedList();
                itemKey = type;
            } else {
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

        // 移除收藏 (修改为 async，以便等待保存完成再刷新界面)
        async function removeFromQuick(quickObj) {
            if (!cachedData.quick_list) return;
            const idx = cachedData.quick_list.findIndex(item => {
                // 如果是分类，比较 category 路径
                if (item.isCategory && quickObj.isCategory) {
                    return item.category === quickObj.category;
                }
                // 如果是节点，比较 type 类名
                if (!item.isCategory && !quickObj.isCategory) {
                    return item.type === quickObj.type;
                }
                return false;
            });

            if (idx !== -1) {
                const newList = [...cachedData.quick_list];
                newList.splice(idx, 1);
                await saveSharedList(newList); // 等待保存完成
            }
        }

        function updateLastCategory(key) {
            // 检查设置：是否记住上次分类
            const shouldRemember = app.ui.settings.getSettingValue("QuickNodeMenu.RememberLast", true);
            if (!shouldRemember) return;

            if (cachedData.last_category === key) return;
            cachedData.last_category = key;
            saveLastCategory(key);
        }

        // --- 构建树 ---
        function buildQuickTree() {
            const tree = {};
            const quickList = cachedData.quick_list || [];

            quickList.forEach(item => {
                let displayTitle = item.title; 
                const type = item.type;
                const isCategory = item.isCategory;
                const categoryPath = item.category;

                if (isCategory) {
                    if (!displayTitle && categoryPath) {
                        const parts = categoryPath.split('/');
                        displayTitle = parts[parts.length - 1];
                    }
                    if (!displayTitle) displayTitle = "Unknown Category";
                    
                    // 修复：使用 categoryPath 作为唯一 Key，防止同名分组被覆盖
                    const uniqueKey = categoryPath || displayTitle;
                    tree[uniqueKey] = {
                        _isCategory: true,
                        _children: buildCategoryChildren(categoryPath),
                        title: displayTitle,
                        type: "CATEGORY", 
                        category: categoryPath
                    };
                } else {
                    if (type && LiteGraph.registered_node_types[type]) {
                        const nodeData = LiteGraph.registered_node_types[type];
                        displayTitle = nodeData.title || nodeData.name || type;
                    }
                    if (!displayTitle) displayTitle = type || "Unknown Node";

                    // 修复：使用 type (类名) 作为唯一 Key，防止同名节点覆盖
                    const uniqueKey = type || displayTitle;
                    tree[uniqueKey] = {
                        _isCategory: false,
                        type: type, 
                        title: displayTitle,
                        category: categoryPath
                    };
                }
            });
            return tree;
        }

        // 辅助：根据分类路径构建子树
        function buildCategoryChildren(categoryPath) {
            const childrenTree = {};
            const registered = LiteGraph.registered_node_types;
            
            const normalizedPath = categoryPath ? categoryPath.trim() : "";

            for (const className in registered) {
                const nodeData = registered[className];
                if (nodeData.hidden) continue;

                const nodeCategory = nodeData.category || "Others";
                
                // 检查节点是否属于该分类
                if (nodeCategory === normalizedPath || nodeCategory.startsWith(normalizedPath + "/")) {
                    
                    let relativePath = "";
                    if (nodeCategory === normalizedPath) {
                        relativePath = "";
                    } else {
                        relativePath = nodeCategory.substring(normalizedPath.length).replace(/^\//, "");
                    }

                    const parts = relativePath ? relativePath.split('/') : [];
                    let currentLevel = childrenTree;
                    
                    for (const part of parts) {
                        if (!currentLevel[part]) {
                            currentLevel[part] = { _isCategory: true, _children: {} };
                        }
                        currentLevel = currentLevel[part]._children;
                    }

                    const displayName = nodeData.title || nodeData.name || className;
                    currentLevel[displayName] = {
                        _isCategory: false,
                        type: className,
                        title: displayName,
                        category: nodeCategory
                    };
                }
            }
            return childrenTree;
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
                    const items = container.querySelectorAll('.quick-menu-item'); 
                    items.forEach(i => i.classList.remove('active'));
                }
            }, { passive: false });
        }

        // 修改后的排序逻辑：支持 Global Node Pins 和 Local Folder Pins
        function sortWithPins(keys, parentPath, structure, defaultSortFn) {
            const localPins = getLocalPinnedList(parentPath);
            const globalNodePins = getGlobalNodePinnedList();

            const pinned = [];
            const unpinned = [];
            
            keys.forEach(k => {
                const item = structure[k];
                let isP = false;
                
                if (item && !item._isCategory && item.type) {
                    // 节点：检查全局列表
                    if (globalNodePins.includes(item.type)) isP = true;
                } else {
                    // 文件夹：检查本地列表
                    if (localPins.includes(k)) isP = true;
                }

                if (isP) pinned.push(k);
                else unpinned.push(k);
            });
            
            pinned.sort((a, b) => {
                const itemA = structure[a];
                const itemB = structure[b];
                
                let scoreA = 999999;
                let scoreB = 999999;

                // 计算 A 的权重
                if (itemA && !itemA._isCategory && itemA.type && globalNodePins.includes(itemA.type)) {
                    scoreA = globalNodePins.indexOf(itemA.type);
                } else if (localPins.includes(a)) {
                    scoreA = 100000 + localPins.indexOf(a);
                }

                // 计算 B 的权重
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
            
            // 修复：按显示的 Title 排序，而不是按 Key (路径) 排序
            const titleA = structure[a].title || a;
            const titleB = structure[b].title || b;
            return titleA.localeCompare(titleB);
        }

        function refreshMenu(container) {
            if (!container || !container._menuArgs) return;
            const { structure, levelIndex, parentPath } = container._menuArgs;
            const scrollTop = container.scrollTop;
            renderMenuContent(container, structure, levelIndex, parentPath);
            container.scrollTop = scrollTop;
        }

        // 右键菜单逻辑
        function showContextMenu(e, parentPath, key, itemData, quickObj, container) {
            e.preventDefault();
            e.stopPropagation();
            closeContextMenu();

            const menu = document.createElement("div");
            menu.className = "quick-menu-context"; 
            
            const isCategory = itemData._isCategory;
            const type = itemData.type;
            const pinned = isPinned(parentPath, key, isCategory, type);
            
            // 选项1: 置顶
            const pinItem = document.createElement("div");
            pinItem.className = "quick-menu-context-item pin-option"; 
            pinItem.innerHTML = pinned ? "取消置顶 (Unpin)" : "置顶 (Pin)";
            pinItem.onclick = (ev) => {
                ev.stopPropagation();
                togglePin(parentPath, key, isCategory, type);
                closeContextMenu(); 
                refreshMenu(container); 
            };
            menu.appendChild(pinItem);

            // 选项2: 移除 (仅在 Root 层级有效，因为这是 Quick Menu 的核心功能)
            if (parentPath === "root") {
                const removeItem = document.createElement("div");
                removeItem.className = "quick-menu-context-item"; 
                removeItem.innerHTML = "移除 (Remove)";
                
                // 修改逻辑：移除后不退出，而是刷新
                removeItem.onclick = async (ev) => {
                    ev.stopPropagation();
                    
                    // 1. 关闭右键菜单
                    closeContextMenu();

                    // 2. 执行移除并等待
                    await removeFromQuick(quickObj);
                    
                    // 3. 重新构建数据树
                    const newTree = buildQuickTree();

                    // 4. 如果没有数据了，则关闭
                    if (Object.keys(newTree).length === 0) {
                        closeAll();
                        return;
                    }

                    // 5. 更新当前菜单的结构数据并刷新
                    // 因为是在 Root 层级操作，container 肯定是 Root 菜单
                    // 我们为了安全起见，关闭所有子菜单 (levelIndex > 0)
                    closeLevelsAfter(container._menuArgs.levelIndex);

                    container._menuArgs.structure = newTree;
                    refreshMenu(container);
                };
                menu.appendChild(removeItem);
            }

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
            const finalKeys = sortWithPins(allKeys, parentPath, structure, defaultSort);

            // 计算当前置顶数量 (用于拖拽判定)
            let pinnedCount = 0;
            finalKeys.forEach(k => {
                const d = structure[k];
                if (isPinned(parentPath, k, d._isCategory, d.type)) pinnedCount++;
            });

            // 拖拽至顶部处理
            container.ondragover = (e) => {
                if (dragSource && dragSource.parentPath === parentPath && !dragSource.isPinned && pinnedCount === 0) {
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
                if (!structure[key]) return;

                const itemData = structure[key];
                const itemDiv = document.createElement("div");
                itemDiv.className = "quick-menu-item"; 
                
                // 构造 Quick 对象用于传参
                const quickObj = itemData._isCategory 
                    ? { title: key, isCategory: true, category: itemData.category }
                    : { title: itemData.title, isCategory: false, type: itemData.type, category: itemData.category };

                const isItemPinned = isPinned(parentPath, key, itemData._isCategory, itemData.type);
                if (isItemPinned) itemDiv.classList.add("pinned");

                if (levelIndex === 0) itemDiv.dataset.key = key; 

                const contentWrapper = document.createElement("div");
                contentWrapper.style.display = "flex";
                contentWrapper.style.alignItems = "center";
                
                const textSpan = document.createElement("span");
                // 修复：显示 title 属性，而不是 Key (因为 Key 现在可能是路径)
                textSpan.textContent = itemData.title || key; 
                contentWrapper.appendChild(textSpan);
                itemDiv.appendChild(contentWrapper);

                if (itemData._isCategory) {
                    const arrow = document.createElement("span");
                    arrow.className = "quick-menu-arrow"; 
                    arrow.textContent = "▶";
                    itemDiv.appendChild(arrow);
                }

                // 拖拽逻辑
                itemDiv.draggable = true;
                itemDiv.ondragstart = (e) => {
                    let currentPinIndex = -1;
                    if (isItemPinned) {
                         if (!itemData._isCategory && itemData.type) {
                             currentPinIndex = getGlobalNodePinnedList().indexOf(itemData.type);
                         } else {
                             currentPinIndex = getLocalPinnedList(parentPath).indexOf(key);
                         }
                    }

                    dragSource = {
                        key: key, // 注意：拖拽逻辑使用 Key (现在是唯一标识)
                        type: itemData.type,
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
                        if (isTopHalf) itemDiv.classList.add("drag-over-top");
                        else itemDiv.classList.add("drag-over-bottom");
                    } else {
                        if (dragSource.isPinned) {
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
                        let targetPinIndex = -1;
                        if (!itemData._isCategory && itemData.type) {
                             targetPinIndex = getGlobalNodePinnedList().indexOf(itemData.type);
                        } else {
                             targetPinIndex = getLocalPinnedList(parentPath).indexOf(key);
                        }

                        if (!isTopHalf) targetPinIndex += 1; 

                        updatePinOrder(parentPath, dragSource.key, dragSource.isCategory, dragSource.type, targetPinIndex);
                        refreshMenu(container); 
                    } 
                    else {
                        if (dragSource.isPinned) {
                            removePin(parentPath, dragSource.key, dragSource.isCategory, dragSource.type);
                            refreshMenu(container); 
                        } 
                    }
                };

                // 点击和悬停事件
                if (itemData._isCategory) {
                    const nextPath = parentPath === "root" ? key : (parentPath + "/" + key);
                    const activateSubmenu = () => {
                        if (levelIndex === 0) updateLastCategory(key);
                        const siblings = container.querySelectorAll('.quick-menu-item'); 
                        siblings.forEach(s => s.classList.remove('active'));
                        itemDiv.classList.add('active');
                        
                        if (hoverTimer) clearTimeout(hoverTimer);
                        
                        // 获取设置中的延迟
                        const delay = app.ui.settings.getSettingValue("QuickNodeMenu.HoverDelay", 40);

                        hoverTimer = setTimeout(() => {
                            closeLevelsAfter(levelIndex); 
                            closeContextMenu();
                            const rect = itemDiv.getBoundingClientRect();
                            let subX = rect.right - 1; 
                            let subY = rect.top;
                            const subMenuEl = showMenu(itemData._children, subX, subY, levelIndex + 1, nextPath);
                            subMenuEl.classList.add('visible'); 
                            
                            // 边界检查
                            const subRect = subMenuEl.getBoundingClientRect();
                            if (subRect.right > window.innerWidth) subMenuEl.style.left = (rect.left - subRect.width + 1) + "px";
                            if (subRect.height > window.innerHeight) subMenuEl.style.top = "10px";
                            else if (subRect.bottom > window.innerHeight) subMenuEl.style.top = Math.max(0, window.innerHeight - subRect.height - 10) + "px";
                        }, delay); 
                    };
                    itemDiv.addEventListener("mouseenter", activateSubmenu);
                    itemDiv.addEventListener("click", (e) => { e.stopPropagation(); activateSubmenu(); });
                } else {
                    itemDiv.addEventListener("click", () => {
                        addNode(itemData.type);
                        closeAll();
                    });
                    itemDiv.addEventListener("mouseenter", () => {
                        const siblings = container.querySelectorAll('.quick-menu-item'); 
                        siblings.forEach(s => s.classList.remove('active'));
                        itemDiv.classList.add('active');
                        if (hoverTimer) clearTimeout(hoverTimer);
                        
                        const delay = app.ui.settings.getSettingValue("QuickNodeMenu.HoverDelay", 40);
                        hoverTimer = setTimeout(() => { closeLevelsAfter(levelIndex); }, delay);
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
            container.className = "quick-menu-container"; 
            
            // --- 应用设置样式 (动态覆盖 CSS) ---
            const opacity = app.ui.settings.getSettingValue("QuickNodeMenu.Opacity", 0.98);
            const fontSize = app.ui.settings.getSettingValue("QuickNodeMenu.FontSize", 12.5);
            const maxWidth = app.ui.settings.getSettingValue("QuickNodeMenu.MaxWidth", 400);

            // 读取新增设置
            const enableBlur = app.ui.settings.getSettingValue("QuickNodeMenu.EnableBlur", true);
            const hoverColorRaw = app.ui.settings.getSettingValue("QuickNodeMenu.ColorHover", "#6c5ce7");
            const validHover = normalizeColor(hoverColorRaw) || "#6c5ce7";

            container.style.background = `rgba(30, 30, 30, ${opacity})`;
            container.style.fontSize = `${fontSize}px`;
            container.style.maxWidth = `${maxWidth}px`;

            // 设置 CSS 变量
            container.style.setProperty('--qnm-blur', enableBlur ? 'blur(8px)' : 'none');
            container.style.setProperty('--qnm-hover-bg', validHover);
            // ------------------------------------

            container._menuArgs = { structure, levelIndex, parentPath };
            
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
                 // [修复] 关键修改：使用 app.canvas.graph 而不是 app.graph，确保节点添加到当前视图（包括子图）
                 app.canvas.graph.add(node);
                 app.canvas.selectNode(node);
             }
        }

        function initMenu() {
            // 检查功能是否启用
            const enabled = app.ui.settings.getSettingValue("QuickNodeMenu.Enabled", true);
            if (!enabled) return;

            // --- 修改：立即获取当前鼠标位置 ---
            // 每次调用 initMenu 时，更新 lockedCanvasPos 为当前画布的鼠标位置
            // 这样无论是快捷键触发还是外部调用，节点都会生成在鼠标当前所在位置
            if (app.canvas && app.canvas.graph_mouse) {
                lockedCanvasPos.x = app.canvas.graph_mouse[0];
                lockedCanvasPos.y = app.canvas.graph_mouse[1];
            }

            closeAll(); 
            // 每次打开时重新获取数据，确保 Add Node Menu 的修改能同步过来
            fetchData().then(() => {
                const screenX = globalMouse.x;
                const screenY = globalMouse.y;

                overlay = document.createElement("div");
                overlay.className = "quick-menu-overlay";
                overlay.onclick = (e) => { e.stopPropagation(); e.preventDefault(); closeAll(); };
                overlay.addEventListener("mousedown", (e) => { closeAll(); });
                overlay.addEventListener("contextmenu", (e) => { e.preventDefault(); closeAll(); });
                document.body.appendChild(overlay);

                // 构建树
                const tree = buildQuickTree();
                
                // 检查是否为空
                if (Object.keys(tree).length === 0) {
                    alert("Quick Menu is empty. Please add nodes from the Add Node Menu (Right Click -> Favorite).");
                    closeAll();
                    return;
                }

                const rootMenu = showMenu(tree, 0, 0, 0, "root"); 

                // 定位逻辑 (记忆上次位置)
                // 检查是否应该记住上次位置
                const shouldRemember = app.ui.settings.getSettingValue("QuickNodeMenu.RememberLast", true);
                const lastCategory = shouldRemember ? cachedData.last_category : null;

                let targetOffsetY = 0;
                let targetOffsetX = 0;
                const rect = rootMenu.getBoundingClientRect();
                let targetEl = null;
                if (lastCategory) targetEl = rootMenu.querySelector(`.quick-menu-item[data-key="${lastCategory}"]`);

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
            });
        }

        // 初始化加载数据
        fetchData();

        // --- 修改：暴露全局变量 ---
        window.alignLayout_openQuickNodeMenu = initMenu;

        // 绑定快捷键
        window.addEventListener("keydown", function(e) {
            // 获取用户设置的快捷键，默认为 Q
            const shortcutSetting = app.ui.settings.getSettingValue("QuickNodeMenu.Shortcut", "Q");

            if (matchShortcut(e, shortcutSetting)) {
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
                
                // --- 互斥逻辑：检测 Add Node Menu 是否存在，存在则点击其遮罩层关闭之 ---
                const addMenuOverlay = document.querySelector(".add-node-menu-overlay");
                if (addMenuOverlay) {
                    addMenuOverlay.click();
                }

                // 修改：不再需要手动赋值 lockedCanvasPos，直接调用 initMenu 即可
                initMenu();
            }
            if (e.key === "Escape") closeAll();
        });
    }
});