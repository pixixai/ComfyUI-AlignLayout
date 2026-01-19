import os
import json
import folder_paths
from server import PromptServer
from aiohttp import web

# 定义基础目录：ComfyUI/user/AlignLayout
USER_DIR = os.path.join(folder_paths.base_path, "user", "AlignLayout")

# 定义三个独立的文件路径 (文件名已修改)
PINS_FILE = os.path.join(USER_DIR, "add_node_menu_pins.json")
QUICK_FILE = os.path.join(USER_DIR, "add_node_menu_quick.json") # 原 favorites 改为 quick
LAST_CAT_FILE = os.path.join(USER_DIR, "add_node_menu_last_category.json")

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
        print(f"[ComfyUI-AlignLayout] Error loading {file_path}: {e}")
        return default_value

# 辅助函数：写入 JSON
def save_json(file_path, data):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[ComfyUI-AlignLayout] Error saving {file_path}: {e}")
        return False

routes = PromptServer.instance.routes

# 1. 聚合读取接口 (GET)
@routes.get("/align-layout/data")
async def get_menu_data(request):
    data = {
        "pins": load_json(PINS_FILE, {}),
        "quick": load_json(QUICK_FILE, []), # 键名改为 quick
        "last_category": load_json(LAST_CAT_FILE, None)
    }
    return web.json_response(data)

# 2. 独立更新接口：置顶 (POST)
@routes.post("/align-layout/pins")
async def update_pins(request):
    try:
        data = await request.json()
        if save_json(PINS_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 3. 独立更新接口：收藏/快捷 (POST) - 改名为 quick
@routes.post("/align-layout/quick")
async def update_quick(request):
    try:
        data = await request.json()
        if save_json(QUICK_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 4. 独立更新接口：最后分类 (POST)
@routes.post("/align-layout/last_category")
async def update_last_category(request):
    try:
        data = await request.json()
        if save_json(LAST_CAT_FILE, data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# 导出空映射防止报错
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}