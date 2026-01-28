import re
import os

def build_readme():
    template_path = 'docs/template.md'
    output_path = 'README.md'
    
    if not os.path.exists(template_path):
        print(f"Error: {template_path} not found.")
        return

    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配标记格式: <!-- INCLUDE:path/to/file.md -->
    pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def fix_image_paths(text, base_dir):
        img_pattern = r'!\[(.*?)\]\((?!http)(.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            new_path = os.path.join(base_dir, img_path).replace("\\", "/")
            return f'![{alt_text}]({new_path})'
        return re.sub(img_pattern, img_replace, text)

    def replace_match(match):
        file_path = match.group(1).strip()
        
        if os.path.exists(file_path):
            print(f"Including content from: {file_path}")
            module_dir = os.path.dirname(file_path)
            # 获取文件名（不带后缀）作为锚点 ID，例如 align.md -> align
            anchor_id = os.path.splitext(os.path.basename(file_path))[0]
            
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                sub_content = sub_f.read()
                fixed_content = fix_image_paths(sub_content, module_dir)
                
                # --- 核心改动：在模块内容前添加一个锚点 ID ---
                return f'\n<div id="{anchor_id}"></div>\n\n{fixed_content}\n'
        else:
            print(f"Warning: File {file_path} not found.")
            return f"<!-- Error: {file_path} not found -->"

    new_content = re.sub(pattern, replace_match, content)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully generated README.md with anchors.")

if __name__ == "__main__":
    build_readme()