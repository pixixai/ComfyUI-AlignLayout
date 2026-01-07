import { app } from "../../scripts/app.js";

// 注册扩展
app.registerExtension({
    name: "Comfy.NodeAligner",
    async setup() {
        // --- 核心参数与状态 ---
        let lastMousePos = { x: 0, y: 0 };
        let flickStartPos = null;
        let flickStartTime = 0;
        let isTrackingFlick = false;

        const radius = 140; 
        const btnBg = "rgba(34, 34, 34, 0.6)"; 
        const iconScale = 0.7; 
        const flickDistThreshold = 80;  
        const flickSpeedThreshold = 0.6; 

        // SVG 图标库 (用户提供的统一版本)
        const svgIcons = {
            top: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="9.13" y="5.78" width="3.45" height="5.52" rx=".82"/><rect fill="#c2c2c2" x="4.66" y="5.78" width="3.45" height="8.28" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" fill="none" x1="3.36" y1="4.48" x2="13.71" y2="4.48"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            bottom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="9.13" y="5.95" width="3.45" height="5.52" rx=".82"/><rect fill="#c2c2c2" x="4.66" y="3.19" width="3.45" height="8.28" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" fill="none" x1="3.36" y1="12.76" x2="13.71" y2="12.76"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="6.5" y="3.45" width="3.45" height="5.52" rx=".82" transform="translate(2.01 14.43) rotate(-90)"/><rect fill="#c2c2c2" x="2.7" y="8.96" width="8.28" height="3.45" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="12.27" y1="13.71" x2="12.27" y2="3.36"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.07 17.07"><rect fill="#c2c2c2" x="7.18" y="3.45" width="3.45" height="5.52" rx=".82" transform="translate(2.69 15.12) rotate(-90)"/><rect fill="#c2c2c2" x="6.14" y="8.96" width="8.28" height="3.45" rx=".82"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="4.85" y1="13.71" x2="4.85" y2="3.36"/><circle fill="none" stroke="none" cx="8.54" cy="8.54" r="8.54"/></svg>`,
            v_center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="6.33" y="3.2" width="2.07" height="4.6" rx=".58"/><rect fill="#c2c2c2" x="2.71" y="2.05" width="2.48" height="6.9" rx=".64"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".52" x1="1.36" y1="5.5" x2="9.64" y2="5.5"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            h_center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="4.47" y="1.48" width="2.07" height="4.6" rx=".58" transform="translate(1.72 9.28) rotate(-90)"/><rect fill="#c2c2c2" x="2.05" y="5.77" width="6.9" height="2.48" rx=".64"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".52" x1="5.5" y1="9.64" x2="5.5" y2="1.36"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_h_gap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="4.36" y="2.77" width="2.28" height="5.47" rx=".54"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="8.92" y1="2.02" x2="8.92" y2="8.98"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.08" y1="2.02" x2="2.08" y2="8.98"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_v_gap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="2.77" y="4.36" width="5.47" height="2.28" rx=".54"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.02" y1="2.08" x2="8.98" y2="2.08"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".69" x1="2.02" y1="8.92" x2="8.92" y2="8.92"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_v_t: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.1" y="3.37" width="4.79" height="1.81" rx=".46"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".3" x1="8.55" y1="2.77" x2="2.45" y2="2.77"/><rect fill="#c2c2c2" x="3.1" y="6.89" width="4.79" height="1.66" rx=".44"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".3" x1="8.55" y1="6.3" x2="2.45" y2="6.3"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_v_m: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="2.77" y="2.95" width="5.47" height="2.07" rx=".52"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".34" x1="8.98" y1="3.99" x2="2.02" y2="3.99"/><rect fill="#c2c2c2" x="2.77" y="6.28" width="5.47" height="1.9" rx=".5"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".34" x1="8.98" y1="7.23" x2="2.02" y2="7.23"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_v_b: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.02" y="5.99" width="4.95" height="1.87" rx=".47"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.65" y1="8.49" x2="2.35" y2="8.49"/><rect fill="#c2c2c2" x="3.02" y="2.51" width="4.95" height="1.72" rx=".45"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.65" y1="4.84" x2="2.35" y2="4.84"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_h_l: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="3.29" y="3.08" width="1.83" height="4.84" rx=".46"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="2.68" y1="2.42" x2="2.68" y2="8.58"/><rect fill="#c2c2c2" x="6.84" y="3.08" width="1.68" height="4.84" rx=".44"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="6.25" y1="2.42" x2="6.25" y2="8.58"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_h_c: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="2.89" y="2.77" width="2.07" height="5.47" rx=".52"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".34" x1="3.92" y1="2.02" x2="3.92" y2="8.98"/><rect fill="#c2c2c2" x="6.22" y="2.77" width="1.9" height="5.47" rx=".5"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".34" x1="7.16" y1="2.02" x2="7.16" y2="8.98"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`,
            dist_h_r: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect fill="#c2c2c2" x="5.88" y="3.02" width="1.88" height="4.96" rx=".47"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="8.37" y1="2.35" x2="8.37" y2="8.65"/><rect fill="#c2c2c2" x="2.39" y="3.02" width="1.72" height="4.96" rx=".45"/><line stroke="#c2c2c2" stroke-linecap="round" stroke-width=".31" x1="4.72" y1="2.35" x2="4.72" y2="8.65"/><circle fill="none" stroke="none" cx="5.5" cy="5.5" r="5.5"/></svg>`
        };

        const ringActions = [
            { icon: svgIcons.right, cmd: "right", angle: 0 },
            { icon: svgIcons.dist_h_gap, cmd: "dist_h_gap", angle: 45 },
            { icon: svgIcons.bottom, cmd: "bottom", angle: 90 },
            { icon: svgIcons.dist_v_gap, cmd: "dist_v_gap", angle: 135 },
            { icon: svgIcons.left, cmd: "left", angle: 180 },
            { icon: svgIcons.h_center, cmd: "h_center", angle: 225 },
            { icon: svgIcons.top, cmd: "top", angle: 270 },
            { icon: svgIcons.v_center, cmd: "v_center", angle: 315 },
        ];

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

        ringActions.forEach(action => {
            const isSpecial = ["top", "bottom", "left", "right"].includes(action.cmd);
            const w = isSpecial ? 63 : 54;
            const h = isSpecial ? 42 : 36;
            const btn = createPillButton(action.icon, w, h, false); // false = absolute
            const rad = (action.angle * Math.PI) / 180;
            btn.style.left = `${250 + radius * Math.cos(rad) - (w / 2)}px`;
            btn.style.top = `${200 + radius * Math.sin(rad) - (h / 2)}px`;
            btn.onclick = (e) => { e.stopPropagation(); alignNodes(action.cmd); };
            ringContainer.appendChild(btn);
        });

        const bottomRow = document.createElement("div");
        bottomRow.style.cssText = "position:absolute; bottom:120px; left:0; width:100%; display:flex; justify-content:center; align-items:center; gap:45px;";
        panel.appendChild(bottomRow);

        const buildGroup = (actions) => {
            const g = document.createElement("div"); g.style.display = "flex"; g.style.gap = "12px";
            actions.forEach(a => {
                const btn = createPillButton(a.icon, 54, 36, true); // true = static
                btn.onclick = (e) => { e.stopPropagation(); alignNodes(a.cmd); };
                g.appendChild(btn);
            });
            return g;
        };

        bottomRow.appendChild(buildGroup([{ icon: svgIcons.dist_h_l, cmd: "dist_h_l" }, { icon: svgIcons.dist_h_c, cmd: "dist_h_c" }, { icon: svgIcons.dist_h_r, cmd: "dist_h_r" }]));
        bottomRow.appendChild(buildGroup([{ icon: svgIcons.dist_v_t, cmd: "dist_v_t" }, { icon: svgIcons.dist_v_m, cmd: "dist_v_m" }, { icon: svgIcons.dist_v_b, cmd: "dist_v_b" }]));

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
            btn.onmouseover = () => { btn.style.background = "rgba(68, 68, 68, 0.7)"; btn.style.transform = "scale(1.08)"; };
            btn.onmouseout = () => { btn.style.background = btnBg; btn.style.transform = "scale(1.0)"; };
            return btn;
        }

        function closePanel() { 
            panel.style.display = "none"; 
            isTrackingFlick = false; 
            window.__comfy_align_active = false;
        }

        window.__comfy_align_close = closePanel;

        window.addEventListener("mousemove", (e) => {
            lastMousePos = { x: e.clientX, y: e.clientY };
            if (panel.style.display === "block" && isTrackingFlick && flickStartPos) {
                const dx = e.clientX - flickStartPos.x;
                const dy = e.clientY - flickStartPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                pointerWrapper.style.transform = `rotate(${angle + 90}deg)`;
                pointerWrapper.style.opacity = dist > 20 ? "1" : "0.3";
                if (dist > flickDistThreshold) {
                    const timeDelta = Date.now() - flickStartTime;
                    if (dist / timeDelta > flickSpeedThreshold) {
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
            if (e.altKey && e.code === "KeyA") {
                const selected = Object.values(app.canvas.selected_nodes || {});
                if (selected.length < 2) return;
                e.preventDefault();
                
                if (window.__comfy_resizer_close) window.__comfy_resizer_close();

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

        // --- 核心修复：更强力的点击外部关闭逻辑 ---
        // 1. 使用 pointerdown：覆盖鼠标、触摸屏和手写笔。
        // 2. 使用 capture=true (捕获阶段)：在 LiteGraph 画布处理事件之前就拦截，
        //    防止画布因为 preventDefault/stopPropagation 而导致 window 级冒泡监听失效。
        // 3. 依赖全局标志位：比检测 DOM style 更可靠。
        window.addEventListener("pointerdown", (e) => {
            if (window.__comfy_align_active) {
                // 如果点击的目标不是功能按钮（或其内部图标）
                if (!e.target.closest(".comfy-node-align-btn")) {
                    // 强制关闭面板
                    closePanel();
                    
                    // 强制重置手势状态 (确保不残留状态)
                    isTrackingFlick = false;
                }
            }
        }, true);

        function alignNodes(type) {
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
                case "dist_h_l": distribute(nodes, 0, false, false); break;
                case "dist_h_c": distribute(nodes, 0, true, false); break;
                case "dist_h_r": distribute(nodes, 0, false, true); break;
                case "dist_v_t": distribute(nodes, 1, false, false); break;
                case "dist_v_m": distribute(nodes, 1, true, false); break;
                case "dist_v_b": distribute(nodes, 1, false, true); break;
            }
            app.canvas.graph.afterChange(); app.canvas.draw(true, true); closePanel();
        }

        function distribute(nodes, axis, isCenter, isEnd) {
            const sorted = [...nodes].sort((a, b) => a.pos[axis] - b.pos[axis]);
            const startNode = sorted[0]; const endNode = sorted[sorted.length - 1];
            let sPos = isCenter ? (startNode.pos[axis] + startNode.size[axis]/2) : (isEnd ? (startNode.pos[axis] + startNode.size[axis]) : startNode.pos[axis]);
            let ePos = isCenter ? (endNode.pos[axis] + endNode.size[axis]/2) : (isEnd ? (endNode.pos[axis] + endNode.size[axis]) : endNode.pos[axis]);
            const step = (ePos - sPos) / (nodes.length - 1);
            sorted.forEach((n, i) => {
                const target = sPos + i * step;
                if (isCenter) n.pos[axis] = target - n.size[axis]/2;
                else if (isEnd) n.pos[axis] = target - n.size[axis];
                else n.pos[axis] = target;
            });
        }
    }
});