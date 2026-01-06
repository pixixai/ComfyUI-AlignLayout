# ComfyUI-AlignLayout

这是一个专为 ComfyUI 设计的生产力增强扩展，旨在通过直观的 **径向菜单 (Radial Menu)** 和 **鼠标甩动手势 (Mouse Flick)**，极大地提升节点对齐、分布以及尺寸调整的效率。

## 🚀 核心特性

- **双模操作**：支持精确的“点击触发”和极速的“甩动触发”。
     ![alt text](images/点击触发.gif)
     ![alt text](images/甩动触发.gif)
- **径向对齐面板 (Alt + A)**：
     ![alt text](images/对齐面板.png)
    - 8 个方向的对齐与分布功能：左/右/顶/底对齐、水平/垂直居中对齐、水平/垂直间距分布。
    - 底部 6 个常用锚点分布按钮：水平左分布、水平居中分布、水平右分布、垂直顶分布、垂直居中分布、垂直底分布
- **径向拉伸面板 (Alt + S)**：
     ![alt text](images/拉伸面板.png)
    - 单侧拉伸（保持另一侧不动）。
    - 支持匹配最大宽度/高度。
    - 一键恢复 **默认尺寸 (320px 宽度)** 或 **最小尺寸**（自适应组件）。
- **智能交互**：
    - **位置自适应**：面板在当前鼠标位置弹出，操作路径极短。
    - **方向指示器**：中心带三角形的小圆环，实时指向鼠标甩动方向。
    - **互斥机制**：两个面板不会同时出现，切换无缝。

## 🛠️ 安装方法（

1. 打开终端，进入你的 ComfyUI 根目录。
   ```
   cd custom_nodes
   ```
2. 执行克隆命令：
    
    ```
    git clone https://github.com/pixixai/Comfyui-NodeAlign.git
    
    ```
    
3. 重启 ComfyUI。

## ⌨️ 快捷键说明

| 快捷键 | 功能 |
| --- | --- |
| **Alt + A** | 呼叫 **对齐面板 (Align)** |
| **Alt + S** | 呼叫 **拉伸面板 (Stretch/Resize)** |

### 💡 小贴士：如何使用“甩动”手势？

按下快捷键后不要松开鼠标，直接快速向目标按钮的方向“甩”出鼠标，功能将瞬间执行并关闭面板。如果你移动较慢，系统会判断为“点击模式”，此时你可以正常点击任何按钮。

## 📁 目录结构

```
ComfyUI-Node-Layout-PowerTools/
├── __init__.py          # 插件加载引导
├── web/
│   ├── align_plugin.js   # 对齐面板逻辑
│   └── stretch_plugin.js # 拉伸面板逻辑
└── README.md
```
# 整合参考
此项目部分灵感参考自 https://github.com/Moooonet/ComfyUI-Align.git 。