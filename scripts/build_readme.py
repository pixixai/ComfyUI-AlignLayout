import re
import os

def build_readme():
    template_path = 'docs/template.md'
    output_path = 'README.md'
    
    if not os.path.exists(template_path):
        print(f"Error: {template_path} not found.")
        return

    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    # --- 1. 修复模板中的图片路径逻辑 ---
    def fix_template_paths(text):
        img_pattern = r'!\[(.*?)\]\((.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            if img_path.startswith(('http', 'https', 'ftp')):
                return match.group(0)
            if img_path.startswith('../'):
                new_path = img_path[3:]
            elif not img_path.startswith('/'):
                new_path = f"docs/{img_path}"
            else:
                new_path = img_path
            return f'![{alt_text}]({new_path})'
        return re.sub(img_pattern, img_replace, text)

    # 先修复图片路径
    processed_content = fix_template_paths(template_content)

    # --- 2. 原地替换 INCLUDE 标记为超链接 ---
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def replace_with_link(match):
        file_path = match.group(1).strip()
        if os.path.exists(file_path):
            display_name = os.path.splitext(os.path.basename(file_path))[0]
            # 尝试从模块文件中提取第一个标题
            try:
                with open(file_path, 'r', encoding='utf-8') as sub_f:
                    for line in sub_f:
                        header_match = re.match(r'^#+\s+(.*)', line)
                        if header_match:
                            display_name = header_match.group(1).strip()
                            break
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
            
            # 返回 Markdown 链接，替换原来的标记
            return f"[{display_name}]({file_path})"
        else:
            print(f"Warning: File {file_path} not found.")
            return f"[{file_path} (File Not Found)]({file_path})"

    # 执行原地替换
    final_content = re.sub(include_pattern, replace_with_link, processed_content)

    # --- 3. 写入最终文件 ---
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully generated {output_path} with in-place links.")

if __name__ == "__main__":
    build_readme()