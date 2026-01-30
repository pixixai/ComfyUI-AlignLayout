import re
import os

def build_readme():
    # --- 【配置区】：输入和输出均为根目录的 README.md ---
    # 逻辑：我们将 README.md 既作为模板，也作为输出目标
    readme_path = 'README.md'
    
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. 修复图片路径逻辑 ---
    # 逻辑：图片统一存放在插件根目录的 images/ 文件夹。
    # 如果你在编辑时直接从文档中拷贝了相对路径（如 ../images/），脚本会自动将其修正。
    def fix_image_paths(text):
        img_pattern = r'!\[(.*?)\]\((.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            
            # 忽略网络图片 (http, https, ftp)
            if img_path.startswith(('http', 'https', 'ftp')):
                return match.group(0)
            
            # 转换逻辑：
            # 1. 如果路径以 ../images/ 开头，修正为 images/ (因为 README 在根目录)
            if img_path.startswith('../images/'):
                new_path = f"images/{img_path[10:]}"
            # 2. 如果路径以 ../../images/ 开头，修正为 images/
            elif img_path.startswith('../../images/'):
                new_path = f"images/{img_path[12:]}"
            # 3. 如果路径已经是 images/ 开头或在根目录，保持不变
            elif img_path.startswith('images/'):
                new_path = img_path
            # 4. 兜底逻辑：如果不包含 images/ 且不是绝对路径，尝试加上 images/
            elif not img_path.startswith(('/', 'images/')):
                new_path = f"images/{img_path}"
            else:
                new_path = img_path
                
            return f'![{alt_text}]({new_path})'
        return re.sub(img_pattern, img_replace, text)

    processed_content = fix_image_paths(content)

    # --- 2. 原地替换 INCLUDE 标记为超链接 ---
    # 逻辑：说明文档位于 web/docs/ 目录下。
    # 脚本会查找 <!-- INCLUDE:文件名.md --> 并将其替换为 [文档标题](web/docs/文件名.md)
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def replace_with_link(match):
        raw_path = match.group(1).strip()
        file_path = raw_path
        
        # 路径自动纠错：脚本会尝试在这些位置寻找源文件以提取标题
        search_paths = [
            file_path,                                  # 原始路径
            os.path.join('web/docs', file_path),        # 补全 web/docs/
            os.path.join('web/docs', os.path.basename(file_path)) # 仅保留文件名并补全路径
        ]
        
        target_file = None
        for p in search_paths:
            if os.path.exists(p):
                target_file = p
                break

        if target_file:
            # 默认使用文件名（不含后缀）作为链接文字
            display_name = os.path.splitext(os.path.basename(target_file))[0]
            try:
                with open(target_file, 'r', encoding='utf-8') as sub_f:
                    for line in sub_f:
                        # 核心逻辑：提取文档内第一行 # 标题作为超链接文字
                        header_match = re.match(r'^#+\s+(.*)', line)
                        if header_match:
                            display_name = header_match.group(1).strip()
                            break
            except Exception as e:
                print(f"Error reading {target_file}: {e}")
            
            # 返回生成的 Markdown 链接，路径指向正确的 web/docs/ 目录
            # 使用 target_file 确保路径在 GitHub 上是可点击的
            return f"[{display_name}]({target_file.replace('\\', '/')})"
        else:
            print(f"Warning: File {raw_path} not found in web/docs/ or current path.")
            return f"[{raw_path} (File Not Found)]({raw_path})"

    # 执行“填空”替换
    final_content = re.sub(include_pattern, replace_with_link, processed_content)

    # --- 3. 写回 README.md ---
    with open(readme_path, 'w', encoding='utf-8') as f:
        # 使用 strip() 确保文件末尾没有多余的空白行
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully updated {readme_path}.")
    print(f"Workflow: Images -> root 'images/', Docs -> 'web/docs/'")

if __name__ == "__main__":
    build_readme()