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

    # 1. 匹配所有的 INCLUDE 标记
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    includes = re.findall(include_pattern, template_content)

    # 2. 预扫描：生成目录 (TOC)
    toc_links = []
    for file_path in includes:
        file_path = file_path.strip()
        if os.path.exists(file_path):
            # 获取锚点 ID (文件名)
            anchor_id = os.path.splitext(os.path.basename(file_path))[0]
            
            # 尝试从模块文件中提取第一个标题作为显示名称
            display_name = anchor_id
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                for line in sub_f:
                    header_match = re.match(r'^#+\s+(.*)', line)
                    if header_match:
                        display_name = header_match.group(1).strip()
                        break
            
            toc_links.append(f"* [📍 {display_name}](#{anchor_id})")

    toc_string = "## 🧭 快速导航\n" + "\n".join(toc_links) + "\n\n---"

    # 3. 路径修复函数
    def fix_image_paths(text, base_dir):
        img_pattern = r'!\[(.*?)\]\((?!http)(.*?)\)'
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            new_path = os.path.join(base_dir, img_path).replace("\\", "/")
            return f'![{alt_text}]({new_path})'
        return re.sub(img_pattern, img_replace, text)

    # 4. 替换内容函数
    def replace_match(match):
        file_path = match.group(1).strip()
        if os.path.exists(file_path):
            module_dir = os.path.dirname(file_path)
            anchor_id = os.path.splitext(os.path.basename(file_path))[0]
            
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                sub_content = sub_f.read()
                fixed_content = fix_image_paths(sub_content, module_dir)
                return f'\n<div id="{anchor_id}"></div>\n\n{fixed_content}\n'
        return f"<!-- Error: {file_path} not found -->"

    # 5. 执行替换：先插入目录，再插入模块内容
    # 如果模板中有 <!-- TOC --> 标记，则替换它；否则默认插入在主标题下方
    if "<!-- TOC -->" in template_content:
        final_content = template_content.replace("<!-- TOC -->", toc_string)
    else:
        # 如果没有占位符，尝试插在第一个大标题后面
        final_content = re.sub(r'(^#\s+.*?\n)', r'\1\n' + toc_string + '\n', template_content, count=1)

    final_content = re.sub(include_pattern, replace_match, final_content)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    print("Successfully generated README.md with Auto-TOC and anchors.")

if __name__ == "__main__":
    build_readme()