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

    # --- 1. 查找模板中所有的 INCLUDE 标记 ---
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    includes = re.findall(include_pattern, template_content)

    # --- 2. 生成目录 (TOC) 字符串 ---
    toc_links = []
    for file_path in includes:
        file_path = file_path.strip()
        if os.path.exists(file_path):
            display_name = os.path.splitext(os.path.basename(file_path))[0]
            
            # 尝试从模块文件中提取第一个标题
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                for line in sub_f:
                    header_match = re.match(r'^#+\s+(.*)', line)
                    if header_match:
                        display_name = header_match.group(1).strip()
                        break
            
            # 移除 📍 符号，生成纯文本链接
            toc_links.append(f"* [{display_name}]({file_path})")
    
    if toc_links:
        toc_string = "## 🧭 详细文档导航\n\n" + "\n".join(toc_links) + "\n"
    else:
        toc_string = ""

    # --- 3. 修复图片路径逻辑 ---
    # 由于 template.md 在 docs/ 目录下，路径如 ../images/xxx.png 在根目录应变为 images/xxx.png
    def fix_template_paths(text):
        # 匹配 ![alt](path) 格式
        img_pattern = r'!\[(.*?)\]\((.*?)\)'
        
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            
            # 如果是网络图片，跳过
            if img_path.startswith(('http', 'https', 'ftp')):
                return match.group(0)
            
            # 修复相对路径：
            # 如果路径以 ../ 开头，说明是引用 docs 同级目录，去掉 ../
            if img_path.startswith('../'):
                new_path = img_path[3:]
            # 如果路径不以 ../ 或 / 开头，说明是 docs 内部路径，补上 docs/
            elif not img_path.startswith('/'):
                new_path = f"docs/{img_path}"
            else:
                new_path = img_path
                
            return f'![{alt_text}]({new_path})'
            
        return re.sub(img_pattern, img_replace, text)

    # --- 4. 执行替换逻辑 ---
    # 首先：修复模板中的图片路径
    final_content = fix_template_paths(template_content)

    # 其次：替换目录占位符
    if "<!-- TOC -->" in final_content:
        final_content = final_content.replace("<!-- TOC -->", toc_string)
    else:
        final_content = re.sub(r'(^#\s+.*?\n)', r'\1\n' + toc_string + '\n', final_content, count=1)

    # 最后：清除所有的 INCLUDE 标记
    final_content = re.sub(include_pattern, "", final_content)

    # --- 5. 写入最终文件 ---
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully generated {output_path} with fixed paths and no emojis.")

if __name__ == "__main__":
    build_readme()