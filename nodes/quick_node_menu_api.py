import os
import json
import folder_paths
from server import PromptServer
from aiohttp import web

# 定义基础目录：ComfyUI/user/AlignLayout
# 保持与 Add Node Menu 一致，以便共享数据
USER_DIR = os.path.join(folder_paths.base_path, "user", "AlignLayout")

# 定义文件路径
# 1. 共享文件 (读取/写入收藏列表)
SHARED_QUICK_FILE = os.path.join(USER_DIR, "add_node_menu_quick.json")

# 2. 独立文件 (Quick Menu 自己的置顶和上次操作记录)
QUICK_MENU_PINS_FILE = os.path.join(USER_DIR, "quick_menu_pins.json")
QUICK_MENU_LAST_CAT_FILE = os.path.join(USER_DIR, "quick_menu_last_category.json")

# 确保目录存在
if not os.path.exists(USER_DIR):
    os.makedirs(USER_DIR, exist_ok=True)

# 辅助函数：读取 JSON
def load_json(file_path, default_value):
    if not os.path.exists(file_path):
        return default_value
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[QuickMenu] Error loading {file_path}: {e}")
        return default_value

# 辅助函数：写入 JSON
def save_json(file_path, data):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[QuickMenu] Error saving {file_path}: {e}")
        return False

routes = PromptServer.instance.routes

# 1. 聚合读取接口 (GET) - 专为 Quick Menu 服务
@routes.get("/quick-menu/data")
async def get_quick_menu_data(request):
    data = {
        "quick_list": load_json(SHARED_QUICK_FILE, []),        # 读取共享的收藏列表
        "pins": load_json(QUICK_MENU_PINS_FILE, {}),           # Quick Menu 自己的置顶
        "last_category": load_json(QUICK_MENU_LAST_CAT_FILE, None) # Quick Menu 自己的最后分类
    }
    return web.json_response(data)

# 2. 更新共享的 Quick 列表 (移除操作用)
@routes.post("/quick-menu/update_list")
async def update_shared_list(request):
    try:
        data = await request.json()
        # 这是一个共享文件，写入操作会影响 Add Node Menu
        if save_json(SHARED_QUICK_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 3. 更新 Quick Menu 自己的置顶
@routes.post("/quick-menu/pins")
async def update_quick_pins(request):
    try:
        data = await request.json()
        if save_json(QUICK_MENU_PINS_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 4. 更新 Quick Menu 自己的最后操作分类
@routes.post("/quick-menu/last_category")
async def update_quick_last_category(request):
    try:
        data = await request.json()
        if save_json(QUICK_MENU_LAST_CAT_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 导出空映射防止报错，确保作为插件被加载
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}