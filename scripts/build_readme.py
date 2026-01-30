import re
import os

def build_readme():
    # --- 【配置区】：现在输入和输出都是根目录的 README.md ---
    # 注意：建议在本地保留带有 <!-- INCLUDE --> 标记的版本进行提交
    readme_path = 'README.md'
    
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. 修复图片路径逻辑 ---
    # 假设图片依然在 web/docs/images/ 或根目录 images/
    def fix_image_paths(text):
        img_pattern = r'!\[(.*?)\]\((.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            if img_path.startswith(('http', 'https', 'ftp')):
                return match.group(0)
            
            # 如果路径指向 web/docs 内部，保持或修正
            # 这里可以根据你的实际图片存放位置微调
            return f'![{alt_text}]({img_path})'
        return re.sub(img_pattern, img_replace, text)

    processed_content = fix_image_paths(content)

    # --- 2. 原地替换 INCLUDE 标记为超链接 ---
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def replace_with_link(match):
        file_path = match.group(1).strip()
        # 脚本在根目录运行，file_path 应为 web/docs/modules/xxx.md
        if os.path.exists(file_path):
            display_name = os.path.splitext(os.path.basename(file_path))[0]
            try:
                with open(file_path, 'r', encoding='utf-8') as sub_f:
                    for line in sub_f:
                        header_match = re.match(r'^#+\s+(.*)', line)
                        if header_match:
                            display_name = header_match.group(1).strip()
                            break
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
            
            # 返回 Markdown 链接
            return f"[{display_name}]({file_path})"
        else:
            print(f"Warning: File {file_path} not found.")
            return f"[{file_path} (File Not Found)]({file_path})"

    # 执行原地替换
    final_content = re.sub(include_pattern, replace_with_link, processed_content)

    # --- 3. 写回 README.md ---
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully updated {readme_path} with documentation links.")

if __name__ == "__main__":
    build_readme()