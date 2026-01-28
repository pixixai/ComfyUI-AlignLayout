# Comfy.RedBoldLinks 技术实现与排错报告

## 1. 插件功能概述

本插件旨在增强 ComfyUI 的连线视觉体验，主要功能包括：

- **强制红线**：无论连线类型如何（IMAGE, LATENT, MODEL 等），所有连线均渲染为**鲜红色 (#FF0000)**。
- **强制加粗**：所有连线宽度统一设置为 **5px**。
- **端口染色开关 (Alt+P)**：通过快捷键切换是否将节点的输入/输出端口也染成红色。默认关闭（保持原色），开启后变为红色。
- **高兼容性**：能够兼容原生 ComfyUI、`CircuitBoardLines`（电路板连线）以及 `link_animations`（动态连线）等常见插件。

## 2. 问题分析与排错历程

在开发过程中，我们遇到了多次修改无效或产生副作用的情况，以下是详细的排错记录：

### 阶段一：简单的属性修改 (失败)

- **尝试**：直接修改 `LGraphCanvas.prototype.connections_width` 和 `default_connection_color`。
- **结果**：端口变色了，但连线颜色没变。
- **原因**：ComfyUI 的某些组件或第三方插件（如 `CircuitBoardLines`）在初始化时会读取配置并缓存，或者直接绕过全局配置，使用硬编码的逻辑绘制。

### 阶段二：对抗渲染劫持 (部分成功)

- **尝试**：拦截 `drawLink` 方法。
- **结果**：当开启 `link_animations` 插件时连线变红了，但关闭该插件（使用默认连线）时又恢复原样。
- **原因**：ComfyUI 默认使用 `renderLink` 方法绘制连线，而 `link_animations` 插件使用更底层的 `drawLink`。我们需要同时拦截这两个入口。

### 阶段三：解决“曲率突变”问题 (关键转折)

- **现象**：成功让连线变红后，发现原本弯曲的贝塞尔曲线变成了奇怪的直线或折线。
- **原因分析**：
    - 我们拦截 `renderLink` 时，假设参数顺序是固定的：第 8 个参数是 `color`，第 9 个是 `line_width`。
    - 然而，`CircuitBoardLines` 插件调用 `renderLink` 时使用了**不同的参数签名**。它传入的是**坐标数组** `[x,y]` 而不是独立的 `x, y` 数字。
    - 这导致原本用于控制 **方向 (Direction)** 的参数位置（Index 7 和 8）被我们要设置的颜色值覆盖了。方向参数错误导致计算出的连线路径（曲率）异常。
- **解决方案**：在代码中引入**参数多态性检测**。通过判断第一个坐标参数 `x1` 是数字还是数组，自动切换修改参数的索引位置（Index 8 vs Index 6）。

## 3. 核心函数参数详解 (API Documentation)

为了兼容不同插件的调用方式，理解 LiteGraph 底层绘图函数的参数至关重要。

### A. `LGraphCanvas.prototype.drawLink`

这是最底层的连线绘制函数，通常被动画类插件直接调用。

| 参数名 | 类型 | 索引 | 说明 | 我们的操作 |
| --- | --- | --- | --- | --- |
| `link_id` | number | 0 | 连线的唯一标识符 | 透传 |
| `ctx` | Context2D | 1 | Canvas 绘图上下文 | 透传 |
| `x1`, `y1` | number | 2, 3 | 起点坐标 | 透传 |
| `x2`, `y2` | number | 4, 5 | 终点坐标 | 透传 |
| `link_index` | number | 6 | 连线在列表中的索引 | 透传 |
| `skip_border` | boolean | 7 | 是否跳过绘制黑色描边（用于高亮时） | 透传 |
| `fillStyle` | string | 8 | 填充颜色（连线通常不用） | 透传 |
| `strokeStyle` | string | **9** | **线条颜色** | **强制替换为 TARGET_COLOR** |
| `lineWidth` | number | **10** | **线条宽度** | **强制替换为 TARGET_WIDTH** |

### B. `LGraphCanvas.prototype.renderLink`

这是标准的连线绘制接口，它有两种截然不同的调用签名。我们的代码通过 `typeof x1 === "number"` 进行自动识别。

### 情况 1：标准模式 (Standard Mode)

适用于 ComfyUI 原生连线、直线、样条曲线等。

| 参数名 | 类型 | 索引 | 说明 | 我们的操作 |
| --- | --- | --- | --- | --- |
| `ctx` | Context2D | 0 | 绘图上下文 | 透传 |
| `x1`, `y1` | number | 1, 2 | 起点坐标 | 透传 |
| `x2`, `y2` | number | 3, 4 | 终点坐标 | 透传 |
| `link` | Object | 5 | 连线数据对象 | 透传 |
| `skip_border` | boolean | 6 | 是否跳过描边 | 透传 |
| `flow` | boolean | 7 | 是否显示流向动画 | 透传 |
| `color` | string | **8** | **连线颜色** | **强制替换为 TARGET_COLOR** |
| `line_width` | number | **9** | **连线宽度** | **强制替换为 TARGET_WIDTH** |

### 情况 2：数组模式 (Array/Circuit Mode)

专用于 `CircuitBoardLines` 等传入坐标数组的插件。

| 参数名 | 类型 | 索引 | 说明 | 我们的操作 |
| --- | --- | --- | --- | --- |
| `ctx` | Context2D | 0 | 绘图上下文 | 设置 `ctx.lineWidth` |
| `startPos` | Array | 1 | `[x, y]` 起点坐标数组 | 透传 (判断依据) |
| `endPos` | Array | 2 | `[x, y]` 终点坐标数组 | 透传 |
| `link` | Object | 3 | 连线数据对象 | 透传 |
| `skip_border` | boolean | 4 | 是否跳过描边 | 透传 |
| `flow` | boolean | 5 | 是否显示流向动画 | 透传 |
| `color` | string | **6** | **连线颜色** | **强制替换为 TARGET_COLOR** |
| `startDir` | number | 7 | 起点方向 (Up/Down/Left/Right) | **严禁修改 (控制曲率)** |
| `endDir` | number | 8 | 终点方向 | **严禁修改 (控制曲率)** |

## 4. 端口颜色控制技术 (Proxy Pattern)

为了实现“Alt+P”动态切换端口颜色而不破坏原始数据，我们使用了 JavaScript 的 `Proxy`（代理）模式。

### 为什么不直接修改数据？

如果我们直接把 `default_connection_color_byType` 里的所有颜色都改成红色，当用户按 Alt+P 关闭功能时，我们很难找回原来的颜色（因为不同类型的节点颜色各不相同）。

### Proxy 的实现逻辑

我们创建了一个代理对象 `dynamicProxy` 覆盖在系统配置之上：

1. **拦截读取 (Getter)**：
    - 当 ComfyUI 问：“IMAGE 类型的端口是什么颜色？”
    - 代理判断开关 `shouldRenderPorts`：
        - 如果为 `true` (开启) -> 直接返回 **红色**。
        - 如果为 `false` (关闭) -> 去查原始表，返回 **蓝色** (或其他原色)。
2. **拦截写入 (Setter)**：
    - 当有新节点注册并试图设置颜色时，代理允许写入到原始表中。这样保证了系统功能的完整性。

```
const dynamicProxy = new Proxy(originalByType, {
    get: (target, prop) => {
        // 开关决定返回值，实现无损切换
        if (shouldRenderPorts) return TARGET_COLOR;
        return target[prop];
    }
});

```

通过这种方式，我们实现了**非破坏性**的实时样式切换。