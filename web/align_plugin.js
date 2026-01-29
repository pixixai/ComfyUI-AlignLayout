import { app } from "../../scripts/app.js";

// 注册扩展
app.registerExtension({
    name: "Comfy.NodeAligner",
    async setup() {
        // --- 设置 ID 常量 ---
        const SETTING_IDS = {
            RADIUS: "NodeAligner.Radius",
            FLICK_DIST: "NodeAligner.FlickDistance",
            FLICK_SPEED: "NodeAligner.FlickSpeed",
            SHORTCUT: "NodeAligner.Shortcut",
            ENABLED: "NodeAligner.Enabled",
            // 按钮配置 ID (仅保留环形菜单)
            BTN_TOP: "NodeAligner.Btn.Top",
            BTN_BOTTOM: "NodeAligner.Btn.Bottom",
            BTN_LEFT: "NodeAligner.Btn.Left",
            BTN_RIGHT: "NodeAligner.Btn.Right",
            BTN_TOP_LEFT: "NodeAligner.Btn.TopLeft",
            BTN_TOP_RIGHT: "NodeAligner.Btn.TopRight",
            BTN_BOTTOM_LEFT: "NodeAligner.Btn.BottomLeft",
            BTN_BOTTOM_RIGHT: "NodeAligner.Btn.BottomRight",
            // 默认间距设置
            GAP_H: "NodeAligner.DefaultGap.H",
            GAP_V: "NodeAligner.DefaultGap.V"
        };

        // --- 核心状态 ---
        let lastMousePos = { x: 0, y: 0 };
        let flickStartPos = null;
        let flickStartTime = 0;
        let isTrackingFlick = false;
        
        // [新增] 内存缓存变量 (刷新页面后会自动重置为 null)
        let cachedGapH = null;
        let cachedGapV = null;

        // 静态常量
        const btnBg = "rgba(34, 34, 34, 0.6)"; 
        const btnHoverBg = "rgba(68, 68, 68, 0.7)"; 
        const iconScale = 0.7; 

        // SVG 图标库
        const svgIcons = {
            top: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="9.13" y="5.78" width="3.45" height="5.52" rx=".82"/><rect fill="#c2c2c2" x="4.66" y="5.78" width="3.45" height="8.28" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" fill="none" x1="3.36" y1="4.48" x2="13.71" y2="4.48"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            bottom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="9.13" y="5.95" width="3.45" height="5.52" rx=".82"/><rect fill="#c2c2c2" x="4.66" y="3.19" width="3.45" height="8.28" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" fill="none" x1="3.36" y1="12.76" x2="13.71" y2="12.76"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="6.5" y="3.45" width="3.45" height="5.52" rx=".82" transform="translate(2.01 14.43) rotate(-90)"/><rect fill="#c2c2c2" x="2.7" y="8.96" width="8.28" height="3.45" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="12.27" y1="13.71" x2="12.27" y2="3.36"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="7.18" y="3.45" width="3.45" height="5.52" rx=".82" transform="translate(2.69 15.12) rotate(-90)"/><rect fill="#c2c2c2" x="6.14" y="8.96" width="8.28" height="3.45" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="4.85" y1="13.71" x2="4.85" y2="3.36"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            v_center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="6.33" y="3.2" width="2.07" height="4.6" rx=".58"/><rect fill="#c2c2c2" x="2.71" y="2.05" width="2.48" height="6.9" rx=".64"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".52" x1="1.36" y1="5.5" x2="9.64" y2="5.5"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            h_center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="4.47" y="1.48" width="2.07" height="4.6" rx=".58" transform="translate(1.72 9.28) rotate(-90)"/><rect fill="#c2c2c2" x="2.05" y="5.77" width="6.9" height="2.48" rx=".64"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".52" x1="5.5" y1="9.64" x2="5.5" y2="1.36"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_h_gap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="4.36" y="2.77" width="2.28" height="5.47" rx=".54"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="8.92" y1="2.02" x2="8.92" y2="8.98"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.08" y1="2.02" x2="2.08" y2="8.98"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_v_gap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="2.77" y="4.36" width="5.47" height="2.28" rx=".54"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.02" y1="2.08" x2="8.98" y2="2.08"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.02" y1="8.92" x2="8.92" y2="8.92"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            spacing_v: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.08" y="3.46" width="4.84" height="1.83" rx=".46" ry=".46"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.58" y1="2.68" x2="2.42" y2="2.68"/><rect fill="#c2c2c2" x="3.08" y="6.07" width="4.84" height="1.68" rx=".44" ry=".44"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.58" y1="8.52" x2="2.42" y2="8.52"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            spacing_h: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.46" y="3.08" width="1.83" height="4.84" rx=".46" ry=".46"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="2.68" y1="2.42" x2="2.68" y2="8.58"/><rect fill="#c2c2c2" x="6.07" y="3.08" width="1.68" height="4.84" rx=".44" ry=".44"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.52" y1="2.42" x2="8.52" y2="8.58"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            auto_layout: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="5.5" y1="3.71" x2="5.5" y2="5.23"/><rect fill="#c2c2c2" x="4.5" y="2.26" width="2" height="2" rx=".31" ry=".31"/><path fill="none" stroke="#c2c2c2" stroke-linecap="round" stroke-width=".28" d="M3.5,6.92v-1.35c0-.17.14-.3.3-.3h3.39c.17,0,.3.14.3.3v1.35"/><rect fill="#c2c2c2" x="2.5" y="6.26" width="2" height="2" rx=".31" ry=".31"/><rect fill="#c2c2c2" x="6.5" y="6.26" width="2" height="2" rx=".31" ry=".31"/></svg>`
        };

        // 命令到图标 Key 的映射
        const cmdToIconKey = {
            "top": "top",
            "bottom": "bottom",
            "left": "left",
            "right": "right",
            "v_center": "v_center",
            "h_center": "h_center",
            "dist_v_gap": "dist_v_gap",
            "dist_h_gap": "dist_h_gap",
            "spacing_dist_v": "spacing_v",
            "spacing_dist_h": "spacing_h",
            "auto_layout": "auto_layout"
        };

        const getIconHtml = (cmd) => {
            const key = cmdToIconKey[cmd] || cmd;
            return svgIcons[key] || "";
        };

        // --- 初始化 UI ---
        const panel = document.createElement("div");
        panel.id = "node-align-panel";
        panel.style.cssText = "display:none; position:fixed; z-index:1001; pointer-events:none; width:500px; height:600px;";

        const ringContainer = document.createElement("div");
        ringContainer.style.cssText = "position:absolute; width:100%; height:400px;";
        panel.appendChild(ringContainer);

        const centralIndicator = document.createElement("div");
        centralIndicator.style.cssText = `position: absolute; width: 40px; height: 40px; left: 230px; top: 180px; border-radius: 50%; border: 2px solid rgba(194, 194, 194, 0.4); background: rgba(0, 0, 0, 0.15); transition: opacity 0.2s; pointer-events: none;`;
        const pointerWrapper = document.createElement("div");
        pointerWrapper.style.cssText = "position:absolute; width:40px; height:40px; left:230px; top:180px; pointer-events:none; transition:transform 0.05s linear;";
        const triangle = document.createElement("div");
        triangle.style.cssText = "position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:10px solid #c2c2c2;";
        pointerWrapper.appendChild(triangle);
        ringContainer.appendChild(centralIndicator);
        ringContainer.appendChild(pointerWrapper);

        // 动态构建环形菜单配置
        let ringActions = [];

        const updateRingButtons = () => {
            // 从设置中读取最新配置
            const s = app.ui.settings;
            ringActions = [
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_RIGHT, "right")), cmd: s.getSettingValue(SETTING_IDS.BTN_RIGHT, "right"), angle: 0 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM_RIGHT, "dist_h_gap")), cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM_RIGHT, "dist_h_gap"), angle: 45 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM, "bottom")), cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM, "bottom"), angle: 90 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_BOTTOM_LEFT, "dist_v_gap")), cmd: s.getSettingValue(SETTING_IDS.BTN_BOTTOM_LEFT, "dist_v_gap"), angle: 135 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_LEFT, "left")), cmd: s.getSettingValue(SETTING_IDS.BTN_LEFT, "left"), angle: 180 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP_LEFT, "h_center")), cmd: s.getSettingValue(SETTING_IDS.BTN_TOP_LEFT, "h_center"), angle: 225 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP, "top")), cmd: s.getSettingValue(SETTING_IDS.BTN_TOP, "top"), angle: 270 },
                { icon: getIconHtml(s.getSettingValue(SETTING_IDS.BTN_TOP_RIGHT, "v_center")), cmd: s.getSettingValue(SETTING_IDS.BTN_TOP_RIGHT, "v_center"), angle: 315 },
            ];

            while (ringContainer.querySelectorAll('.comfy-node-align-btn').length > 0) {
                ringContainer.querySelector('.comfy-node-align-btn').remove();
            }

            const currentRadius = app.ui.settings.getSettingValue(SETTING_IDS.RADIUS, 140);

            ringActions.forEach(action => {
                const isSpecial = ["top", "bottom", "left", "right"].includes(action.cmd);
                const w = isSpecial ? 63 : 54;
                const h = isSpecial ? 42 : 36;
                const btn = createPillButton(action.icon, w, h, false);
                const rad = (action.angle * Math.PI) / 180;
                btn.style.left = `${250 + currentRadius * Math.cos(rad) - (w / 2)}px`;
                btn.style.top = `${200 + currentRadius * Math.sin(rad) - (h / 2)}px`;
                btn.onclick = (e) => { e.stopPropagation(); alignNodes(action.cmd); };
                ringContainer.appendChild(btn);
            });
        };

        // --- 底部控制栏 ---
        const bottomRow = document.createElement("div");
        bottomRow.style.cssText = "position:absolute; bottom:160px; left:0; width:100%; display:flex; justify-content:center; align-items:center; gap:40px;";
        panel.appendChild(bottomRow);

        // 创建胶囊型控制组 (左数值 - 右图标)
        // [修改] 参数改为 currentValue 和 onInput 回调
        const createCapsuleGroup = (cmd, tooltip, currentValue, onInput) => {
            const iconHtml = getIconHtml(cmd);
            const container = document.createElement("div");
            container.style.cssText = `
                display: flex; 
                align-items: center; 
                gap: 2px; 
                background: ${btnBg}; 
                border: 1px solid rgba(102, 102, 102, 0.3);
                border-radius: 999px; 
                padding: 4px 8px; 
                pointer-events: auto;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            `;
            
            const input = document.createElement("input");
            input.type = "number";

            // [修改] 直接使用传入的当前值 (内存值或默认值)
            input.value = currentValue;

            input.style.cssText = `
                width: 40px; 
                height: 24px; 
                background: transparent; 
                border: none; 
                color: #666; 
                text-align: right; 
                font-size: 13px; 
                line-height: 24px;
                padding-top: 2px;
                outline: none;
                transition: color 0.2s;
            `;
            
            const highlightInput = () => { input.style.color = "#c2c2c2"; };
            const dimInput = () => { if(document.activeElement !== input) input.style.color = "#666"; };
            
            input.onmouseenter = highlightInput;
            input.onmouseleave = dimInput;
            input.onfocus = highlightInput;
            input.onblur = dimInput;
            input.onclick = (e) => { e.stopPropagation(); input.focus(); };
            input.onpointerdown = (e) => e.stopPropagation(); 

            // [修改] 监听输入变化，更新内存变量
            if (onInput) {
                input.addEventListener("input", () => {
                   onInput(input.value); 
                });
            }

            const trigger = () => {
                let val = parseInt(input.value);
                if (isNaN(val)) val = 50;
                alignNodes(cmd, val);
            };
            input.onkeydown = (e) => {
                e.stopPropagation();
                if (e.key === "Enter") trigger();
            };

            const btn = document.createElement("div");
            btn.innerHTML = iconHtml;
            btn.title = tooltip;
            btn.style.cssText = `
                width: 28px; 
                height: 28px; 
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                transition: transform 0.2s, background-color 0.2s, filter 0.2s;
                border-radius: 50%; 
            `;
            const svg = btn.querySelector("svg");
            if (svg) {
                svg.style.width = "20px";
                svg.style.height = "20px";
                svg.style.display = "block";
            }
            
            btn.onmouseover = () => { 
                btn.style.transform = "scale(1.15)"; 
                btn.style.backgroundColor = "rgba(255, 255, 255, 0.1)"; 
                btn.style.filter = "brightness(1.5)"; 
                highlightInput(); 
            };
            btn.onmouseout = () => { 
                btn.style.transform = "scale(1.0)"; 
                btn.style.backgroundColor = "transparent";
                btn.style.filter = "none";
                dimInput(); 
            };
            btn.onclick = (e) => { e.stopPropagation(); trigger(); };

            container.appendChild(input);
            container.appendChild(btn);
            return container;
        };

        // 动态刷新底部栏 (恢复为固定三个按钮，但读取默认间距设置)
        const updateBottomRow = () => {
            bottomRow.innerHTML = ""; // 清空
            const s = app.ui.settings;
            
            // 获取用户设置的默认间距
            const defGapV = s.getSettingValue(SETTING_IDS.GAP_V, 50);
            const defGapH = s.getSettingValue(SETTING_IDS.GAP_H, 50);

            // [修改] 优先使用内存中的值，如果为 null 则使用默认值
            const currentV = cachedGapV !== null ? cachedGapV : defGapV;
            const currentH = cachedGapH !== null ? cachedGapH : defGapH;

            // 1. 左侧胶囊 (垂直分布)
            bottomRow.appendChild(createCapsuleGroup(
                "spacing_dist_v", 
                "Vertical Distribution Spacing (Stack & Center X)", 
                currentV, 
                (val) => cachedGapV = val // 回调更新内存变量
            ));

            // 2. 中间按钮 (自动布局)
            const autoLayoutBtn = createPillButton(getIconHtml("auto_layout"), 36, 36, true);
            autoLayoutBtn.title = "Auto Layout (Graph)";
            autoLayoutBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.__comfy_auto_layout_instance) {
                    window.__comfy_auto_layout_instance.arrangeNodes();
                    closePanel();
                } else {
                    console.warn("Auto Layout extension not initialized.");
                }
            };
            bottomRow.appendChild(autoLayoutBtn);

            // 3. 右侧胶囊 (水平分布)
            bottomRow.appendChild(createCapsuleGroup(
                "spacing_dist_h", 
                "Horizontal Distribution Spacing (Row & Center Y)", 
                currentH, 
                (val) => cachedGapH = val // 回调更新内存变量
            ));
        };

        document.body.appendChild(panel);

        function createPillButton(html, w, h, isStatic = false) {
            const btn = document.createElement("button");
            btn.innerHTML = html;
            btn.className = "comfy-node-align-btn";
            const posType = isStatic ? "static" : "absolute";
            btn.style.cssText = `box-sizing: border-box; position: ${posType}; width: ${w}px; height: ${h}px; border-radius: 999px; border: 1px solid rgba(102, 102, 102, 0.3); background: ${btnBg}; color: white; cursor: pointer; pointer-events: auto; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; padding: 0; transition: transform 0.1s, background 0.2s; flex-shrink: 0;`;
            
            const svg = btn.querySelector("svg");
            if (svg) {
                const iconSize = Math.min(w, h) * iconScale;
                svg.style.width = `${iconSize}px`; svg.style.height = `${iconSize}px`; svg.style.display = "block";
            }
            if (!isStatic) { 
                btn.onmouseover = () => { btn.style.background = btnHoverBg; btn.style.transform = "scale(1.08)"; };
                btn.onmouseout = () => { btn.style.background = btnBg; btn.style.transform = "scale(1.0)"; };
            } else {
                btn.onmouseover = () => { btn.style.background = btnHoverBg; btn.style.transform = "scale(1.15)"; };
                btn.onmouseout = () => { btn.style.background = btnBg; btn.style.transform = "scale(1.0)"; };
            }
            return btn;
        }

        function closePanel() { 
            panel.style.display = "none"; 
            isTrackingFlick = false; 
            window.__comfy_align_active = false;
        }

        window.__comfy_align_close = closePanel;

        window.addEventListener("mousemove", (e) => {
            const enabled = app.ui.settings.getSettingValue(SETTING_IDS.ENABLED, true);
            if (!enabled) return;

            lastMousePos = { x: e.clientX, y: e.clientY };
            if (panel.style.display === "block" && isTrackingFlick && flickStartPos) {
                const dx = e.clientX - flickStartPos.x;
                const dy = e.clientY - flickStartPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                pointerWrapper.style.transform = `rotate(${angle + 90}deg)`;
                
                const currentDistThreshold = app.ui.settings.getSettingValue(SETTING_IDS.FLICK_DIST, 80);
                const currentSpeedThreshold = app.ui.settings.getSettingValue(SETTING_IDS.FLICK_SPEED, 0.6);

                pointerWrapper.style.opacity = dist > 20 ? "1" : "0.3";
                if (dist > currentDistThreshold) {
                    const timeDelta = Date.now() - flickStartTime;
                    if (dist / timeDelta > currentSpeedThreshold) {
                        isTrackingFlick = false; 
                        handleFlickGesture((angle + 360) % 360);
                    }
                }
            }
        }, true);

        function handleFlickGesture(angle) {
            let closest = ringActions[0];
            let minDiff = 360;
            ringActions.forEach(a => {
                let diff = Math.abs(angle - a.angle);
                if (diff > 180) diff = 360 - diff;
                if (diff < minDiff) { minDiff = diff; closest = a; }
            });
            alignNodes(closest.cmd);
        }

        window.addEventListener("keydown", (e) => {
            const enabled = app.ui.settings.getSettingValue(SETTING_IDS.ENABLED, true);
            if (!enabled) return;

            const shortcutStr = app.ui.settings.getSettingValue(SETTING_IDS.SHORTCUT, "Alt+A");
            if (!shortcutStr) return;

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

            if (match) {
                const selected = Object.values(app.canvas.selected_nodes || {});
                if (selected.length < 2) return;
                e.preventDefault();
                
                if (window.__comfy_resizer_close) window.__comfy_resizer_close();

                updateRingButtons();
                updateBottomRow(); // 每次打开时更新底部栏

                panel.style.left = (lastMousePos.x - 250) + "px";
                panel.style.top = (lastMousePos.y - 200) + "px";
                panel.style.display = "block";
                window.__comfy_align_active = true;

                flickStartPos = { ...lastMousePos };
                flickStartTime = Date.now();
                isTrackingFlick = true;
                pointerWrapper.style.transform = `rotate(0deg)`;
            }
            if (e.code === "Escape") closePanel();
        });

        window.addEventListener("pointerdown", (e) => {
            if (window.__comfy_align_active) {
                if (e.target.tagName === "INPUT") return;
                if (!e.target.closest(".comfy-node-align-btn") && !e.target.closest("input") && !e.target.closest("div[style*='border-radius: 999px']")) {
                    closePanel();
                    isTrackingFlick = false;
                }
            }
        }, true);

        function alignNodes(type, value = 50) {
            const nodes = Object.values(app.canvas.selected_nodes || {});
            if (nodes.length < 2) return;
            app.canvas.graph.beforeChange();
            const b = {
                minX: Math.min(...nodes.map(n => n.pos[0])),
                maxX: Math.max(...nodes.map(n => n.pos[0] + n.size[0])),
                minY: Math.min(...nodes.map(n => n.pos[1])),
                maxY: Math.max(...nodes.map(n => n.pos[1] + n.size[1])),
                avgCX: nodes.reduce((acc, n) => acc + (n.pos[0] + n.size[0]/2), 0) / nodes.length,
                avgCY: nodes.reduce((acc, n) => acc + (n.pos[1] + n.size[1]/2), 0) / nodes.length
            };
            switch (type) {
                case "left": nodes.forEach(n => n.pos[0] = b.minX); break;
                case "right": nodes.forEach(n => n.pos[0] = b.maxX - n.size[0]); break;
                case "top": nodes.forEach(n => n.pos[1] = b.minY); break;
                case "bottom": nodes.forEach(n => n.pos[1] = b.maxY - n.size[1]); break;
                case "h_center": nodes.forEach(n => n.pos[0] = b.avgCX - n.size[0]/2); break;
                case "v_center": nodes.forEach(n => n.pos[1] = b.avgCY - n.size[1]/2); break;
                
                case "dist_h_gap": {
                    nodes.sort((a,b)=>a.pos[0]-b.pos[0]);
                    const tw = nodes.reduce((acc,n)=>acc+n.size[0], 0);
                    const gap = (b.maxX-b.minX-tw)/(nodes.length-1);
                    let x = b.minX; nodes.forEach(n=>{n.pos[0]=x; x+=n.size[0]+gap;});
                    break;
                }
                case "dist_v_gap": {
                    nodes.sort((a,b)=>a.pos[1]-b.pos[1]);
                    const th = nodes.reduce((acc,n)=>acc+n.size[1], 0);
                    const gap = (b.maxY-b.minY-th)/(nodes.length-1);
                    let y = b.minY; nodes.forEach(n=>{n.pos[1]=y; y+=n.size[1]+gap;});
                    break;
                }

                case "spacing_dist_v": {
                    distributeWithSpacing(nodes, 1, value, true);
                    break;
                }
                case "spacing_dist_h": {
                    distributeWithSpacing(nodes, 0, value, true);
                    break;
                }
                
                case "auto_layout": {
                    if (window.__comfy_auto_layout_instance) {
                        window.__comfy_auto_layout_instance.arrangeNodes();
                    }
                    break;
                }
            }
            app.canvas.graph.afterChange(); app.canvas.draw(true, true); closePanel();
        }

        // --- 智能锚点查找函数 ---
        function getAnchorNode(nodes, axis) {
            const primaryProp = axis === 0 ? 0 : 1; 
            const secondaryProp = axis === 0 ? 1 : 0; 

            // 1. 找到主轴上的最小值
            const minVal = Math.min(...nodes.map(n => n.pos[primaryProp]));
            
            // 2. 筛选出在容差范围内 (5px) 的“最左/最上”候选节点
            const tolerance = 5;
            let candidates = nodes.filter(n => n.pos[primaryProp] <= minVal + tolerance);

            // 3. 按副轴排序
            candidates.sort((a, b) => a.pos[secondaryProp] - b.pos[secondaryProp]);
            
            // 筛选出副轴上也是“最靠前”的节点 (容差5px)
            const minSecVal = candidates[0].pos[secondaryProp];
            candidates = candidates.filter(n => n.pos[secondaryProp] <= minSecVal + tolerance);

            // 4. 优先选择“工作流开头”节点
            const isStartNode = (n) => {
                if (!n.inputs || n.inputs.length === 0) return true;
                return !n.inputs.some(inp => inp.link !== null);
            };

            const startNodes = candidates.filter(isStartNode);
            if (startNodes.length > 0) {
                candidates = startNodes;
            }

            // 5. 最后使用 ID 排序兜底
            candidates.sort((a, b) => a.id - b.id);

            return candidates[0];
        }

        // --- 优化后的间距分布函数 ---
        function distributeWithSpacing(nodes, axis, gap, alignCrossAxis) {
            // 1. 智能选择锚点
            const anchor = getAnchorNode(nodes, axis);

            // 2. 将锚点从列表中移除，剩余节点进行排序
            let remaining = nodes.filter(n => n.id !== anchor.id);
            const crossAxis = axis === 0 ? 1 : 0;
            
            remaining.sort((a, b) => {
                const diff1 = a.pos[axis] - b.pos[axis];
                if (Math.abs(diff1) > 5) return diff1;
                
                const diff2 = a.pos[crossAxis] - b.pos[crossAxis];
                if (Math.abs(diff2) > 5) return diff2;

                return a.id - b.id;
            });

            // 3. 构建最终处理队列，锚点必须在第一位
            const sorted = [anchor, ...remaining];

            const getVisualSize = (node, ax) => {
                if (ax === 1) { 
                    if (node.type === "Reroute" || node.type === "Reroute (rgthree)") {
                        return node.size[1];
                    }
                    const titleHeight = (window.LiteGraph && window.LiteGraph.NODE_TITLE_HEIGHT) || 30;
                    return node.size[1] + titleHeight;
                }
                return node.size[0];
            };
            
            // 初始化位置
            let currentPos = anchor.pos[axis] + getVisualSize(anchor, axis) + gap;
            
            // 计算副轴对齐中心 (基于锚点)
            const anchorVisualSizeOnCross = getVisualSize(anchor, crossAxis);
            const anchorCenter = anchor.pos[crossAxis] + anchorVisualSizeOnCross / 2;

            sorted.forEach((n, i) => {
                if (i === 0) return; // 锚点位置不动

                // 更新主轴位置
                n.pos[axis] = currentPos;
                
                // 累加位置
                currentPos += getVisualSize(n, axis) + gap;

                if (alignCrossAxis) {
                    // 更新副轴位置 (居中对齐)
                    const myVisualSizeOnCross = getVisualSize(n, crossAxis);
                    n.pos[crossAxis] = anchorCenter - myVisualSizeOnCross / 2;
                }
            });
        }
    }
});