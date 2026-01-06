# 这是一个占位文件，用于触发 ComfyUI 对该插件目录的加载
# 由于对齐逻辑完全在前端实现，这里不需要定义实际的执行节点

class AlignNodesPlaceholder:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {}}
    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "utils"

    def do_nothing(self):
        return ()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}