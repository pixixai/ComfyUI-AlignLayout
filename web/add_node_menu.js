import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// 注入自定义 CSS 样式
// 使用 CSS 变量来支持动态颜色设置
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
        background: rgba(30, 30, 30, 0.98); /* 默认值，会被JS覆盖 */
        border: 1px solid #444;
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
        backdrop-filter: var(--anm-blur, blur(8px)); /* 动态毛玻璃 */
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
        border-left: 3px solid transparent; 
    }

    /* 悬停状态 - 动态颜色 */
    .add-node-menu-item:hover, .add-node-menu-item.active {
        background: var(--anm-hover-bg, #2a60a8);
        color: white;
    }

    /* 置顶状态 (背景加深) */
    .add-node-menu-item.pinned {
        background-color: rgba(0, 0, 0, 0.4); 
    }
    .add-node-menu-item.pinned:hover, .add-node-menu-item.pinned.active {
        background: var(--anm-hover-bg, #2a60a8);
    }

    /* Quick 标记状态 - 动态颜色 */
    .add-node-menu-item.quick-marked {
        border-left: 3px solid var(--anm-mark-color, #2ecc71); 
        background-color: var(--anm-mark-bg, rgba(46, 204, 113, 0.05)); 
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
        background: var(--anm-hover-bg, #2a60a8);
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
        const GLOBAL_NODE_PINS_KEY = "__ALL_NODES__";

        const DEFAULT_PRIMARY_CATEGORIES = [
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
                    if (!cachedData.pins) {
                        cachedData.pins = {};
                    }
                    if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) {
                        cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
                    }
                }
            } catch (e) { 
                console.error("[AddNodeMenu] Load failed", e); 
            }
        }

        async function savePins(pinsData) {
            try {
                await api.fetchApi("/align-layout/pins", {
                    method: "POST",
                    body: JSON.stringify(pinsData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { 
                console.error("Save pins failed", e); 
            }
        }

        async function saveQuick(quickData) { 
            try {
                await api.fetchApi("/align-layout/quick", {
                    method: "POST",
                    body: JSON.stringify(quickData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { 
                console.error("Save quick failed", e); 
            }
        }

        async function saveLastCategory(categoryData) {
            try {
                await api.fetchApi("/align-layout/last_category", {
                    method: "POST",
                    body: JSON.stringify(categoryData),
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) { 
                console.error("Save last category failed", e); 
            }
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

        function hexToRgba(hex, alpha) {
            let c = hex.substring(1);
            if (c.length === 3) {
                c = c.split('').map(char => char + char).join('');
            }
            const num = parseInt(c, 16);
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        // --- 辅助函数：快捷键匹配 ---
        function matchShortcut(e, shortcutStr) {
            if (!shortcutStr) return false;
            const parts = shortcutStr.split('+').map(s => s.trim().toLowerCase());
            let key = parts.pop();
            if (key === "space") key = " ";
            if (e.key.toLowerCase() !== key) return false;
            
            const ctrl = parts.includes("ctrl");
            const alt = parts.includes("alt");
            const shift = parts.includes("shift");
            const meta = parts.includes("meta") || parts.includes("cmd");
            
            if (e.ctrlKey !== ctrl) return false;
            if (e.altKey !== alt) return false;
            if (e.shiftKey !== shift) return false;
            if (e.metaKey !== meta) return false;
            
            return true;
        }

        function getPrimaryCategories() {
            const settingStr = app.ui.settings.getSettingValue("AddNodeMenu.PrimaryCategories", "");
            if (!settingStr) return DEFAULT_PRIMARY_CATEGORIES;
            return settingStr.split(/,|，/).map(s => s.trim()).filter(s => s);
        }

        // --- 核心逻辑函数 ---

        function getLocalPinnedList(parentPath) {
            if (!cachedData.pins) cachedData.pins = {};
            return cachedData.pins[parentPath] || [];
        }

        function getGlobalNodePinnedList() {
            if (!cachedData.pins) cachedData.pins = {};
            if (!cachedData.pins[GLOBAL_NODE_PINS_KEY]) cachedData.pins[GLOBAL_NODE_PINS_KEY] = [];
            return cachedData.pins[GLOBAL_NODE_PINS_KEY];
        }

        function isPinned(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                const globalList = getGlobalNodePinnedList();
                return globalList.includes(type);
            } else {
                const localList = getLocalPinnedList(parentPath);
                return localList.includes(key);
            }
        }

        function togglePin(parentPath, key, isCategory, type) {
            if (!isCategory && type) {
                const list = getGlobalNodePinnedList();
                const idx = list.indexOf(type);
                if (idx === -1) {
                    list.push(type);
                } else {
                    list.splice(idx, 1);
                }
                savePins(cachedData.pins);
            } else {
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
        
        function isQuick(quickObj) {
            if (!cachedData.quick) return false;
            return cachedData.quick.some(f => {
                if (f.isCategory && quickObj.isCategory) {
                    return f.category === quickObj.category; 
                }
                if (!f.isCategory && !quickObj.isCategory) {
                    return f.type === quickObj.type; 
                }
                return false;
            });
        }

        function addQuick(quickObj) {
            if (!cachedData.quick) cachedData.quick = [];
            const exists = isQuick(quickObj);
            if (!exists) {
                cachedData.quick.push({
                    type: quickObj.type,
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
                if (f.isCategory && quickObj.isCategory) return f.category === quickObj.category;
                if (!f.isCategory && !quickObj.isCategory) return f.type === quickObj.type;
                return false;
             });
             if (idx !== -1) {
                 cachedData.quick.splice(idx, 1);
                 saveQuick(cachedData.quick);
             }
        }

        function updateLastCategory(key) {
            const shouldRemember = app.ui.settings.getSettingValue("AddNodeMenu.RememberLast", true);
            if (!shouldRemember) return;
            if (cachedData.last_category === key) return;
            cachedData.last_category = key;
            saveLastCategory(key);
        }

        function buildNodeTree() {
            const tree = {};
            const registered = LiteGraph.registered_node_types;

            // 获取排除列表
            const excludeStr = app.ui.settings.getSettingValue("AddNodeMenu.ExcludeList", "");
            const excludeList = excludeStr.split(/,|，/).map(s => s.trim().toLowerCase()).filter(s => s);

            for (const className in registered) {
                const nodeData = registered[className];
                if (nodeData.hidden) continue;

                const category = nodeData.category || UNCATEGORIZED_NAME;
                const displayName = nodeData.title || nodeData.name || className;

                // 排除逻辑：检查分类名或节点名是否包含排除关键字
                if (excludeList.length > 0) {
                    const lowerCat = category.toLowerCase();
                    const lowerName = displayName.toLowerCase();
                    const shouldExclude = excludeList.some(ex => lowerCat.includes(ex) || lowerName.includes(ex));
                    if (shouldExclude) {
                        continue;
                    }
                }

                const parts = category.split('/');
                
                let currentLevel = tree;
                for (const part of parts) {
                    if (!currentLevel[part]) {
                        currentLevel[part] = { _isCategory: true, _children: {} };
                    }
                    currentLevel = currentLevel[part]._children;
                }
                
                currentLevel[displayName] = { 
                    _isCategory: false, 
                    type: className, 
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
            const categories = getPrimaryCategories();
            return categories.findIndex(p => p.toLowerCase() === key.toLowerCase());
        }

        function sortWithPins(keys, parentPath, structure, defaultSortFn) {
            const localPins = getLocalPinnedList(parentPath);
            const globalNodePins = getGlobalNodePinnedList();

            const pinned = [];
            const unpinned = [];
            
            keys.forEach(k => {
                const item = structure[k];
                let isP = false;
                
                if (item && !item._isCategory && item.type) {
                    if (globalNodePins.includes(item.type)) isP = true;
                } else {
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
            const type = itemData.type; 
            
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

            let pinnedCount = 0;
            finalKeys.forEach(k => {
                if (k === "---SEPARATOR---") return;
                const d = structure[k];
                if (isPinned(parentPath, k, d._isCategory, d.type)) pinnedCount++;
            });

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
                             const targetIndex = pinnedCount; 
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
                
                const quickObj = itemData._isCategory
                    ? { title: key, type: "CATEGORY", isCategory: true, category: (parentPath === "root" ? key : parentPath + "/" + key) }
                    : { title: itemData.title, type: itemData.type, isCategory: false, category: itemData.category };
                
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
                    let currentPinIndex = -1;
                    if (isItemPinned) {
                         if (!itemData._isCategory && itemData.type) {
                             currentPinIndex = getGlobalNodePinnedList().indexOf(itemData.type);
                         } else {
                             currentPinIndex = getLocalPinnedList(parentPath).indexOf(key);
                         }
                    }

                    dragSource = {
                        key: key, 
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
                        if (dragSource.isPinned) itemDiv.classList.add("drag-over-unpin");
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
                    } else {
                        if (dragSource.isPinned) {
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
                        const delay = app.ui.settings.getSettingValue("AddNodeMenu.HoverDelay", 40);
                        
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
                        const siblings = container.querySelectorAll('.add-node-menu-item'); 
                        siblings.forEach(s => s.classList.remove('active'));
                        itemDiv.classList.add('active');
                        if (hoverTimer) clearTimeout(hoverTimer);
                        const delay = app.ui.settings.getSettingValue("AddNodeMenu.HoverDelay", 40);
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
            container.className = "add-node-menu-container"; 
            
            // --- 应用设置样式 ---
            const opacity = app.ui.settings.getSettingValue("AddNodeMenu.Opacity", 0.98);
            const fontSize = app.ui.settings.getSettingValue("AddNodeMenu.FontSize", 12.5);
            const maxWidth = app.ui.settings.getSettingValue("AddNodeMenu.MaxWidth", 400);

            // 新增设置项读取
            const enableBlur = app.ui.settings.getSettingValue("AddNodeMenu.EnableBlur", true);
            const hoverColorRaw = app.ui.settings.getSettingValue("AddNodeMenu.ColorHover", "#2a60a8");
            const markColorRaw = app.ui.settings.getSettingValue("AddNodeMenu.ColorMark", "#2ecc71");

            const validHover = normalizeColor(hoverColorRaw) || "#2a60a8";
            const validMark = normalizeColor(markColorRaw) || "#2ecc71";
            const markBg = hexToRgba(validMark, 0.05);

            container.style.background = `rgba(30, 30, 30, ${opacity})`;
            container.style.fontSize = `${fontSize}px`;
            container.style.maxWidth = `${maxWidth}px`;
            
            // 设置 CSS 变量
            container.style.setProperty('--anm-blur', enableBlur ? 'blur(8px)' : 'none');
            container.style.setProperty('--anm-hover-bg', validHover);
            container.style.setProperty('--anm-mark-color', validMark);
            container.style.setProperty('--anm-mark-bg', markBg);
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
                 app.graph.add(node);
                 app.canvas.selectNode(node);
             }
        }

        function initMenu() {
            const enabled = app.ui.settings.getSettingValue("AddNodeMenu.Enabled", true);
            if (!enabled) return;

            // --- 修改：立即获取当前鼠标位置 ---
            // 每次调用 initMenu 时，更新 lockedCanvasPos 为当前画布的鼠标位置
            // 这样无论是快捷键触发还是外部调用，节点都会生成在鼠标当前所在位置
            if (app.canvas && app.canvas.graph_mouse) {
                lockedCanvasPos.x = app.canvas.graph_mouse[0];
                lockedCanvasPos.y = app.canvas.graph_mouse[1];
            }

            closeAll(); 
            fetchData();

            // 菜单UI显示位置 (屏幕坐标)
            const screenX = globalMouse.x;
            const screenY = globalMouse.y;

            overlay = document.createElement("div");
            overlay.className = "add-node-menu-overlay"; 
            overlay.onclick = (e) => { e.stopPropagation(); e.preventDefault(); closeAll(); };
            overlay.addEventListener("mousedown", (e) => { closeAll(); });
            overlay.addEventListener("contextmenu", (e) => { e.preventDefault(); closeAll(); });
            document.body.appendChild(overlay);

            // 此时获取设置并过滤节点树
            const tree = buildNodeTree();
            const rootMenu = showMenu(tree, 0, 0, 0, "root"); 

            const shouldRemember = app.ui.settings.getSettingValue("AddNodeMenu.RememberLast", true);
            const lastCategory = shouldRemember ? cachedData.last_category : null;

            let targetOffsetY = 0;
            let targetOffsetX = 0;
            const rect = rootMenu.getBoundingClientRect();
            let targetEl = null;
            if (lastCategory) {
                targetEl = rootMenu.querySelector(`.add-node-menu-item[data-key="${lastCategory}"]`); 
            }

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
        
        // --- 修改：暴露全局变量 ---
        window.alignLayout_openAddNodeMenu = initMenu;

        window.addEventListener("keydown", function(e) {
            const shortcutSetting = app.ui.settings.getSettingValue("AddNodeMenu.Shortcut", "A");
            
            if (matchShortcut(e, shortcutSetting)) {
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
                
                const quickOverlay = document.querySelector(".quick-menu-overlay");
                if (quickOverlay) {
                    quickOverlay.click();
                }

                // 修改：不再需要手动赋值 lockedCanvasPos，直接调用 initMenu 即可
                initMenu();
            }
            if (e.key === "Escape") closeAll();
        });
    }
});