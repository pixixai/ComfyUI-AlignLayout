import { app } from "../../scripts/app.js";

// 注入 CSS 样式
const styleElement = document.createElement("style");
styleElement.textContent = `
    #comfy-better-search-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.2);
        z-index: 10000;
        display: none;
        font-family: sans-serif;
    }

    #comfy-better-search-box {
        position: absolute;
        width: 660px;
        background: transparent;
        border: none;
        box-shadow: none;
        display: flex;
        flex-direction: column;
    }

    #comfy-better-search-input {
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        background: #222;
        color: #eee;
        outline: none;
        border: 1px solid #00bfff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        margin-bottom: 8px;
    }

    #comfy-better-search-results {
        max-height: 400px;
        overflow-y: auto;
        background: #17181a;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        padding: 6px 0; 
        display: none; 
    }
    
    #comfy-better-search-results.has-results {
        display: block;
    }

    .better-search-item {
        padding: 10px 16px;
        margin: 4px 6px; 
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #ccc;
        font-size: 14px;
        transition: background 0.1s;
    }

    .better-search-item:hover, .better-search-item.selected {
        background: #26272a;
        color: white;
    }

    .better-search-item .node-category {
        font-size: 10px;
        opacity: 0.5;
        background: rgba(0,0,0,0.3);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 10px;
        white-space: nowrap;
    }

    #comfy-better-search-results::-webkit-scrollbar {
        width: 6px;
    }
    #comfy-better-search-results::-webkit-scrollbar-track {
        background: transparent;
    }
    #comfy-better-search-results::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
    }
`;
document.head.appendChild(styleElement);

// --- 搜索辅助逻辑 ---

const CORE_CATEGORIES = new Set([
    "sampling", "loaders", "conditioning", "latent", "image", 
    "mask", "utils", "advanced", "postprocessing"
]);

const getEnglishInitials = (str) => {
    return str
        .split(/[^a-zA-Z0-9]/)
        .filter(Boolean)
        .map(word => word[0].toLowerCase())
        .join("");
};

/**
 * 识别是否为 ComfyUI 官方核心节点
 */
const isComfyCoreNode = (nodeObj) => {
    // 1. 检查 node_data 中的作者信息
    const author = nodeObj.node_data?.author || "";
    if (author.startsWith("Comfy Core") || author === "comfyanonymous" || author === "ComfyUI") {
        return true;
    }
    
    // 2. 检查分类兜底
    const category = nodeObj.category || "";
    const baseCategory = category.split('/')[0].toLowerCase();
    return CORE_CATEGORIES.has(baseCategory);
};

const getStringMatchScore = (target, query, initials) => {
    const t = target.toLowerCase();
    const q = query.toLowerCase();
    
    if (t === q) return 100; // 完全匹配
    if (t.startsWith(q)) return 80; // 开头匹配
    if (t.includes(q)) return 60; // 包含匹配
    if (initials) {
        if (initials.startsWith(q)) return 40; // 首字母开头匹配
        if (initials.includes(q)) return 20; // 首字母包含匹配
    }
    return 0;
};

// --- 插件主体 ---

app.registerExtension({
    name: "Comfy.BetterSearch",
    init() {
        const overlay = document.createElement("div");
        overlay.id = "comfy-better-search-overlay";
        const box = document.createElement("div");
        box.id = "comfy-better-search-box";
        const input = document.createElement("input");
        input.id = "comfy-better-search-input";
        input.placeholder = "搜索节点... (S键呼出, 支持拼音首字母)";
        input.autocomplete = "off";
        const resultsList = document.createElement("div");
        resultsList.id = "comfy-better-search-results";

        box.appendChild(input);
        box.appendChild(resultsList);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        let selectedIndex = 0;
        let filteredNodes = [];
        let mousePos = [0, 0];
        let screenMouseX = 0;
        let screenMouseY = 0;

        window.addEventListener("mousemove", (e) => {
            screenMouseX = e.clientX;
            screenMouseY = e.clientY;
        });

        const getAllNodeTypes = () => {
            const nodes = [];
            let index = 0;
            for (const type in LiteGraph.registered_node_types) {
                const nodeObj = LiteGraph.registered_node_types[type];
                if (nodeObj) {
                    const title = nodeObj.title || nodeObj.name || type;
                    const category = nodeObj.category || "Unknown";
                    nodes.push({
                        id: index + 1,
                        type: type,
                        title: title,
                        category: category,
                        isCore: isComfyCoreNode(nodeObj),
                        titleInitials: getEnglishInitials(title),
                        typeInitials: getEnglishInitials(type)
                    });
                    index++;
                }
            }
            return nodes;
        };

        const closeSearch = () => {
            overlay.style.display = "none";
            input.value = "";
            resultsList.innerHTML = "";
            resultsList.classList.remove("has-results");
            if (app.canvas) app.canvas.canvas.focus();
        };

        const addNode = (nodeType) => {
            if (!nodeType) return;
            const node = LiteGraph.createNode(nodeType);
            if (node) {
                node.pos = [mousePos[0], mousePos[1]];
                app.graph.add(node);
                if(app.canvas.ds.scale > 0.5) node.alignToGrid();
                app.canvas.selectNode(node);
                app.canvas.bringToFront(node);
            }
            closeSearch();
        };

        const renderList = () => {
            resultsList.innerHTML = "";
            if (filteredNodes.length === 0) {
                const emptyItem = document.createElement("div");
                emptyItem.className = "better-search-item";
                emptyItem.style.cursor = "default";
                emptyItem.style.justifyContent = "center";
                emptyItem.innerHTML = `<span style="opacity:0.5; font-style:italic;">未找到匹配节点</span>`;
                resultsList.appendChild(emptyItem);
                resultsList.classList.add("has-results");
                return;
            }

            resultsList.classList.add("has-results");
            filteredNodes.forEach((node, index) => {
                const item = document.createElement("div");
                item.className = `better-search-item ${index === selectedIndex ? "selected" : ""}`;
                
                item.innerHTML = `
                    <div style="display: flex; align-items: baseline; overflow: hidden; white-space: nowrap;">
                        <span style="font-weight: bold; color: #eee; font-family: sans-serif; margin-right: 8px;">${node.title}</span>
                        <span style="opacity: 0.5; font-size: 12px; font-family: sans-serif;">${node.type}</span>
                    </div>
                    <span class="node-category">${node.category}</span>
                `;
                
                item.onclick = () => addNode(node.type);
                item.onmouseenter = () => {
                    const prev = resultsList.children[selectedIndex];
                    if(prev) prev.classList.remove("selected");
                    selectedIndex = index;
                    item.classList.add("selected");
                };
                resultsList.appendChild(item);
            });
            
            if (resultsList.children[selectedIndex]) {
                resultsList.children[selectedIndex].scrollIntoView({ block: "nearest" });
            }
        };

        input.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            const allNodes = getAllNodeTypes();
            
            if (!query) {
                filteredNodes = allNodes.sort((a, b) => {
                    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
                    return a.id - b.id;
                }).slice(0, 50);
                renderList();
                return;
            }

            filteredNodes = allNodes
                .map(node => {
                    const titleScore = getStringMatchScore(node.title, query, node.titleInitials);
                    const typeScore = getStringMatchScore(node.type, query, node.typeInitials);
                    const baseMaxScore = Math.max(titleScore, typeScore);
                    
                    // 核心修改：如果是 Comfy Core 节点，给予巨大的权重加成 (+1000)
                    // 这确保了核心节点的包含匹配 (1060分) 会排在第三方的完全匹配 (100分) 之上
                    const finalScore = baseMaxScore > 0 ? (baseMaxScore + (node.isCore ? 1000 : 0)) : 0;

                    return { 
                        node, 
                        titleScore, 
                        typeScore, 
                        finalScore 
                    };
                })
                .filter(item => item.finalScore > 0)
                .sort((a, b) => {
                    // 1. 优先比较最终得分（包含 Core Boost 加成）
                    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
                    
                    // 2. 如果分数相同（同为核心或同为第三方且匹配度相同），标题匹配度高的优先
                    if (a.titleScore !== b.titleScore) return b.titleScore - a.titleScore;

                    // 3. 注册名匹配度高的优先
                    if (a.typeScore !== b.typeScore) return b.typeScore - a.typeScore;
                    
                    // 4. 最后字母顺序
                    return a.node.title.localeCompare(b.node.title);
                })
                .map(item => item.node)
                .slice(0, 50);

            selectedIndex = 0;
            renderList();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredNodes.length - 1);
                renderList();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderList();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredNodes[selectedIndex]) {
                    addNode(filteredNodes[selectedIndex].type);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
            }
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeSearch();
        });

        window.addEventListener("keydown", (e) => {
            if (e.target === input) return;
            const activeTag = document.activeElement.tagName.toUpperCase();
            if (activeTag === "INPUT" || activeTag === "TEXTAREA" || document.activeElement.isContentEditable) return;

            if (e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (app.canvas) mousePos = app.canvas.graph_mouse.slice(); 
                else mousePos = [0, 0];

                overlay.style.display = "block";
                const boxWidth = 660; 
                let posX = screenMouseX;
                let posY = screenMouseY;
                if (posX + boxWidth > window.innerWidth) posX = window.innerWidth - boxWidth - 20;
                if (posY > window.innerHeight - 300) posY = window.innerHeight - 400;

                box.style.left = `${posX}px`;
                box.style.top = `${posY}px`;

                input.value = "";
                input.focus();
                
                filteredNodes = getAllNodeTypes().sort((a, b) => {
                    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
                    return a.id - b.id;
                }).slice(0, 50);
                selectedIndex = 0;
                renderList();
            }
        });
    }
});