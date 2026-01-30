import re
import os

def build_readme():
    # --- 【配置区】：输入和输出均为根目录的 README.md ---
    readme_path = 'README.md'
    
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. 修复图片路径逻辑 ---
    # 逻辑：图片在根目录的 images/ 文件夹。
    # 如果模板中使用了从 web/docs/ 视角出发的相对路径（如 ../images/），需要修复为根目录路径。
    def fix_image_paths(text):
        img_pattern = r'!\[(.*?)\]\((.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            
            # 忽略网络图片
            if img_path.startswith(('http', 'https', 'ftp')):
                return match.group(0)
            
            # 路径转换逻辑：
            # 1. 如果路径以 ../images/ 开头（通常是从 web/docs 拷贝来的路径），转换为 images/
            if img_path.startswith('../images/'):
                new_path = f"images/{img_path[10:]}"
            # 2. 如果路径以 ../../images/ 开头，转换为 images/
            elif img_path.startswith('../../images/'):
                new_path = f"images/{img_path[12:]}"
            # 3. 如果已经是正确路径或网络路径，保持不变
            elif img_path.startswith('images/'):
                new_path = img_path
            # 4. 默认兜底：如果不是 / 开头且不包含 images/，尝试补全
            elif not img_path.startswith(('/', 'images/')):
                new_path = f"images/{img_path}"
            else:
                new_path = img_path
                
            return f'![{alt_text}]({new_path})'
        return re.sub(img_pattern, img_replace, text)

    processed_content = fix_image_paths(content)

    # --- 2. 原地替换 INCLUDE 标记为超链接 ---
    # 逻辑：文档现在位于 web/docs/ 目录下
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def replace_with_link(match):
        raw_path = match.group(1).strip()
        file_path = raw_path
        
        # 路径自动纠错：如果只写了文件名，或者写了 docs/xxx.md，自动指向 web/docs/
        search_paths = [
            file_path,
            os.path.join('web/docs', file_path),
            os.path.join('web/docs', os.path.basename(file_path))
        ]
        
        target_file = None
        for p in search_paths:
            if os.path.exists(p):
                target_file = p
                break

        if target_file:
            display_name = os.path.splitext(os.path.basename(target_file))[0]
            try:
                with open(target_file, 'r', encoding='utf-8') as sub_f:
                    for line in sub_f:
                        # 提取文档中第一个 # 标题作为链接文字
                        header_match = re.match(r'^#+\s+(.*)', line)
                        if header_match:
                            display_name = header_match.group(1).strip()
                            break
            except Exception as e:
                print(f"Error reading {target_file}: {e}")
            
            # 返回 Markdown 链接，路径指向 web/docs/xxx.md
            return f"[{display_name}]({target_file})"
        else:
            print(f"Warning: File {raw_path} not found in web/docs/ or current path.")
            return f"[{raw_path} (File Not Found)]({raw_path})"

    # 执行替换
    final_content = re.sub(include_pattern, replace_with_link, processed_content)

    # --- 3. 写回 README.md ---
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully updated {readme_path}.")
    print(f"Images linked to root 'images/' and Docs linked to 'web/docs/'.")

if __name__ == "__main__":
    build_readme()