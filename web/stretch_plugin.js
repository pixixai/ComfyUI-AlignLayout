import { app } from "../../scripts/app.js";

// 注册扩展
app.registerExtension({
    name: "Comfy.NodeResizer",
    async setup() {
        // --- 设置 ID 常量 ---
        const SETTING_IDS = {
            RADIUS: "NodeResizer.Radius",
            FLICK_DIST: "NodeResizer.FlickDistance",
            FLICK_SPEED: "NodeResizer.FlickSpeed",
            SHORTCUT: "NodeResizer.Shortcut",
            ENABLED: "NodeResizer.Enabled",
            // 按钮配置 ID
            BTN_TOP: "NodeResizer.Btn.Top",
            BTN_BOTTOM: "NodeResizer.Btn.Bottom",
            BTN_LEFT: "NodeResizer.Btn.Left",
            BTN_RIGHT: "NodeResizer.Btn.Right",
            BTN_TOP_LEFT: "NodeResizer.Btn.TopLeft",
            BTN_TOP_RIGHT: "NodeResizer.Btn.TopRight",
            BTN_BOTTOM_LEFT: "NodeResizer.Btn.BottomLeft",
            BTN_BOTTOM_RIGHT: "NodeResizer.Btn.BottomRight"
        };

        // --- 核心参数与状态 ---
        let lastMousePos = { x: 0, y: 0 };
        let flickStartPos = null;
        let flickStartTime = 0;
        let isTrackingFlick = false;

        // 静态常量
        const btnBg = "rgba(34, 34, 34, 0.6)"; 
        const iconScale = 0.7; 

        // SVG 图标库
        const svgIcons = {
            top: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="4.89" y="6.6" width="7.3" height="7.3" rx="1.13"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".69" fill="none" x1="3.36" y1="4.48" x2="13.71" y2="4.48"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            bottom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="4.89" y="3.17" width="7.3" height="7.3" rx="1.13"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".69" fill="none" x1="3.36" y1="12.59" x2="13.71" y2="12.59"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="3.17" y="4.89" width="7.3" height="7.3" rx="1.13"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".69" fill="none" x1="12.59" y1="3.36" x2="12.59" y2="13.71"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="6.6" y="4.89" width="7.3" height="7.3" rx="1.13"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".69" fill="none" x1="4.48" y1="3.36" x2="4.48" y2="13.71"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            h_max: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.41" y="3.38" width="4.19" height="4.19" rx=".65"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".46" fill="none" x1="9.15" y1="1.9" x2="9.15" y2="9.1"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".46" fill="none" x1="1.85" y1="1.9" x2="1.85" y2="9.1"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            v_max: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.43" y="3.41" width="4.19" height="4.19" rx=".65"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-miterlimit="10" stroke-width=".46" fill="none" x1="9.1" y1="9.15" x2="1.9" y2="9.15"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".46" fill="none" x1="9.1" y1="1.85" x2="1.9" y2="1.85"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            def_size: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="8.66 4.69 8.66 2.76 6.73 2.76"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="4.59 2.76 2.66 2.76 2.66 4.69"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="6.73 8.76 8.66 8.76 8.66 6.84"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="2.66 6.84 2.66 8.76 4.59 8.76"/></svg>`,
            min_size: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="7.2 2 7.2 4 9.2 4"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="2.2 4 4.2 4 4.2 2"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="4.2 9 4.2 7 2.2 7"/><polyline stroke="#c2c2c2" stroke-miterlimit="10" stroke-width=".86" fill="none" points="9.2 7 7.2 7 7.2 9"/></svg>`
        };

        // 命令到图标 Key 的映射
        const cmdToIconKey = {
            "stretch_right": "right",
            "def_size": "def_size",
            "stretch_bottom": "bottom",
            "min_size": "min_size",
            "stretch_left": "left",
            "h_max": "h_max",
            "stretch_top": "top",
            "v_max": "v_max"
        };

        const getIconHtml = (cmd) => {
            const key = cmdToIconKey[cmd] || cmd;
            return svgIcons[key] || "";
        };

        // 按顺时针映射 8 个方向 (此数组现由 updateRingButtons 动态生成，此处仅保留引用结构)
        let ringActions = [];

        // --- UI 初始化 ---
        const panel = document.createElement("div");
        panel.id = "node-resizer-panel";
        panel.style.cssText = "display:none; position:fixed; z-index:1002; pointer-events:none; width:500px; height:500px;";

        const ringContainer = document.createElement("div");
        ringContainer.style.cssText = "position:absolute; width:100%; height:100%;";
        panel.appendChild(ringContainer);

        // 中心指示器 (小圆环 + 外部三角形)
        const indicatorContainer = document.createElement("div");
        indicatorContainer.style.cssText = "position:absolute; width:40px; height:40px; left:230px; top:180px; pointer-events:none;";
        const centralCircle = document.createElement("div");
        centralCircle.style.cssText = `position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid rgba(194, 194, 194, 0.4); background: rgba(0, 0, 0, 0.15);`;
        const pointerWrapper = document.createElement("div");
        pointerWrapper.style.cssText = "position:absolute; width:100%; height:100%; transition:transform 0.05s linear; opacity: 0.3;";
        const triangle = document.createElement("div");
        triangle.style.cssText = `position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:10px solid #c2c2c2;`;
        
        pointerWrapper.appendChild(triangle);
        indicatorContainer.appendChild(centralCircle);
        indicatorContainer.appendChild(pointerWrapper);
        ringContainer.appendChild(indicatorContainer);

        // 更新按钮位置函数 (支持动态半径 + 动态设置)
        const updateRingButtons = () => {
             // 从设置中读取最新配置
             const s = app.ui.settings;
             ringActions = [
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_RIGHT, "stretch_right")), title: "Right", cmd: s.getSettingValue(SETTING_IDS.BTN_RIGHT, "stretch_right"), angle: 0 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM_RIGHT, "def_size")), title: "Bottom-Right", cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM_RIGHT, "def_size"), angle: 45 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM, "stretch_bottom")), title: "Bottom", cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM, "stretch_bottom"), angle: 90 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM_LEFT, "min_size")), title: "Bottom-Left", cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM_LEFT, "min_size"), angle: 135 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_LEFT, "stretch_left")), title: "Left", cmd: s.getSettingValue(SETTING_IDS.BTN_LEFT, "stretch_left"), angle: 180 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP_LEFT, "h_max")), title: "Top-Left", cmd: s.getSettingValue(SETTING_IDS.BTN_TOP_LEFT, "h_max"), angle: 225 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP, "stretch_top")), title: "Top", cmd: s.getSettingValue(SETTING_IDS.BTN_TOP, "stretch_top"), angle: 270 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP_RIGHT, "v_max")), title: "Top-Right", cmd: s.getSettingValue(SETTING_IDS.BTN_TOP_RIGHT, "v_max"), angle: 315 },
             ];

             // 清空旧按钮
             while (ringContainer.querySelectorAll('.comfy-node-resizer-btn').length > 0) {
                ringContainer.querySelector('.comfy-node-resizer-btn').remove();
            }

            // 获取当前半径设置
            const currentRadius = app.ui.settings.getSettingValue(SETTING_IDS.RADIUS, 140);

            // 渲染按钮
            ringActions.forEach(action => {
                // 根据当前分配的命令判断按钮形状 (如果分配的是单向拉伸，用长条形；否则用短圆形)
                const isSpecial = ["stretch_top", "stretch_bottom", "stretch_left", "stretch_right"].includes(action.cmd);
                const w = isSpecial ? 63 : 54;
                const h = isSpecial ? 42 : 36;
                
                const btn = createPillButton(action.icon, action.title, w, h);
                const rad = (action.angle * Math.PI) / 180;
                
                // 中心定位计算
                btn.style.left = `${250 + currentRadius * Math.cos(rad) - (w / 2)}px`;
                btn.style.top = `${200 + currentRadius * Math.sin(rad) - (h / 2)}px`;
                btn.onclick = (e) => { e.stopPropagation(); processResize(action.cmd); };
                ringContainer.appendChild(btn);
            });
        };

        // 初始构建
        updateRingButtons();

        document.body.appendChild(panel);

        function createPillButton(html, title, w, h) {
            const btn = document.createElement("button");
            btn.innerHTML = html;
            btn.title = title;
            btn.className = "comfy-node-resizer-btn";
            btn.style.cssText = `box-sizing: border-box; position: absolute; width: ${w}px; height: ${h}px; border-radius: 999px; border: 1px solid rgba(102, 102, 102, 0.3); background: ${btnBg}; color: white; cursor: pointer; pointer-events: auto; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; padding: 0; transition: transform 0.1s, background 0.2s;`;
            const svg = btn.querySelector("svg");
            if (svg) {
                const iconSize = Math.min(w, h) * iconScale;
                svg.style.width = `${iconSize}px`; svg.style.height = `${iconSize}px`; svg.style.display = "block";
            }
            btn.onmouseover = () => { btn.style.background = "rgba(68, 68, 68, 0.7)"; btn.style.transform = "scale(1.08)"; };
            btn.onmouseout = () => { btn.style.background = btnBg; btn.style.transform = "scale(1.0)"; };
            return btn;
        }

        function closePanel() { 
            panel.style.display = "none"; 
            isTrackingFlick = false; 
            window.__comfy_resizer_active = false;
        }

        // 挂载全局关闭函数供对齐插件调用
        window.__comfy_resizer_close = closePanel;

        window.addEventListener("mousemove", (e) => {
            // 检查功能是否启用
            const enabled = app.ui.settings.getSettingValue(SETTING_IDS.ENABLED, true);
            if (!enabled) return;

            lastMousePos = { x: e.clientX, y: e.clientY };
            if (panel.style.display === "block" && isTrackingFlick && flickStartPos) {
                const dx = e.clientX - flickStartPos.x;
                const dy = e.clientY - flickStartPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                pointerWrapper.style.transform = `rotate(${angle + 90}deg)`;
                
                // 获取当前的甩动阈值
                const currentDistThreshold = app.ui.settings.getSettingValue(SETTING_IDS.FLICK_DIST, 80);
                const currentSpeedThreshold = app.ui.settings.getSettingValue(SETTING_IDS.FLICK_SPEED, 0.6);
                
                pointerWrapper.style.opacity = dist > 20 ? "1" : "0.3";
                if (dist > currentDistThreshold) {
                    const timeDelta = Date.now() - flickStartTime;
                    if (dist / timeDelta > currentSpeedThreshold) {
                        isTrackingFlick = false; 
                        handleFlick((angle + 360) % 360);
                    }
                }
            }
        }, true);

        function handleFlick(angle) {
            let closest = ringActions[0];
            let minDiff = 360;
            ringActions.forEach(a => {
                let diff = Math.abs(angle - a.angle);
                if (diff > 180) diff = 360 - diff;
                if (diff < minDiff) { minDiff = diff; closest = a; }
            });
            processResize(closest.cmd);
        }

        window.addEventListener("keydown", (e) => {
            // 检查功能是否启用
            const enabled = app.ui.settings.getSettingValue(SETTING_IDS.ENABLED, true);
            if (!enabled) return;

            // 获取当前的快捷键设置 (例如 "Alt+S")
            const shortcutStr = app.ui.settings.getSettingValue(SETTING_IDS.SHORTCUT, "Alt+S");
            
            if (!shortcutStr) return;

             // 解析快捷键字符串
            const keys = shortcutStr.split('+').map(k => k.trim().toLowerCase());
            const mainKey = keys.pop(); 
            
            const isCtrl = keys.includes('ctrl') || keys.includes('control');
            const isAlt = keys.includes('alt') || keys.includes('option');
            const isShift = keys.includes('shift');
            const isMeta = keys.includes('meta') || keys.includes('cmd') || keys.includes('command');
            
            if (e.ctrlKey !== isCtrl) return;
            if (e.altKey !== isAlt) return;
            if (e.shiftKey !== isShift) return;
            if (e.metaKey !== isMeta) return;

            const code = e.code.toLowerCase();
            const key = e.key.toLowerCase();
            
            let match = false;
            if (key === mainKey) match = true;
            if (code === mainKey) match = true;
            if (code === 'key' + mainKey) match = true;
            if (code === mainKey) match = true;

            if (match) {
                const selected = Object.values(app.canvas.selected_nodes || {});
                if (selected.length < 1) return;
                e.preventDefault();
                
                // 互斥：强制关闭对齐面板
                if (window.__comfy_align_close) window.__comfy_align_close();

                // 在打开面板时，重新计算按钮位置（以防 Radius 改变或按钮配置改变）
                updateRingButtons();

                panel.style.left = (lastMousePos.x - 250) + "px";
                panel.style.top = (lastMousePos.y - 200) + "px";
                panel.style.display = "block";
                window.__comfy_resizer_active = true;

                flickStartPos = { ...lastMousePos };
                flickStartTime = Date.now();
                isTrackingFlick = true;
                pointerWrapper.style.transform = `rotate(0deg)`;
            }
            if (e.code === "Escape") closePanel();
        });

        // --- 核心修复：点击外部关闭 (使用 pointerdown 和全局标志位) ---
        window.addEventListener("pointerdown", (e) => {
            // 只有当面板处于激活状态时才处理
            if (window.__comfy_resizer_active) {
                // 如果点击的不是本插件的任何按钮 (使用 closest 方法检测)
                if (!e.target.closest(".comfy-node-resizer-btn")) {
                    // 强制关闭
                    closePanel();
                    // 重置滑动手势状态
                    isTrackingFlick = false;
                }
            }
        }, true);

        function processResize(cmd) {
            const nodes = Object.values(app.canvas.selected_nodes || {});
            if (nodes.length < 1) return;
            app.canvas.graph.beforeChange();
            
            const minY = Math.min(...nodes.map(n => n.pos[1]));
            const maxY = Math.max(...nodes.map(n => n.pos[1] + n.size[1]));
            const minX = Math.min(...nodes.map(n => n.pos[0]));
            const maxX = Math.max(...nodes.map(n => n.pos[0] + n.size[0]));
            const maxW = Math.max(...nodes.map(n => n.size[0]));
            const maxH = Math.max(...nodes.map(n => n.size[1]));

            nodes.forEach(node => {
                switch (cmd) {
                    case "stretch_top":
                        const tOff = node.pos[1] - minY;
                        node.pos[1] = minY; node.size[1] += tOff;
                        break;
                    case "stretch_bottom":
                        node.size[1] = maxY - node.pos[1];
                        break;
                    case "stretch_left":
                        const lOff = node.pos[0] - minX;
                        node.pos[0] = minX; node.size[0] += lOff;
                        break;
                    case "stretch_right":
                        node.size[0] = maxX - node.pos[0];
                        break;
                    case "h_max":
                        const cxH = node.pos[0] + node.size[0] / 2;
                        node.size[0] = maxW; node.pos[0] = cxH - maxW / 2;
                        break;
                    case "v_max":
                        const cyV = node.pos[1] + node.size[1] / 2;
                        node.size[1] = maxH; node.pos[1] = cyV - maxH / 2;
                        break;
                    case "min_size":
                        if (node.computeSize) node.size = node.computeSize();
                        break;
                    case "def_size":
                        // 强制重置：宽度锁定 320，高度通过 computeSize 自动计算最小容纳值
                        const autoH = node.computeSize ? node.computeSize()[1] : 80;
                        node.size = [320, autoH];
                        break;
                }
                if (node.onResize) node.onResize(node.size);
            });
            app.canvas.graph.afterChange(); app.canvas.draw(true, true); closePanel();
        }
    }
});