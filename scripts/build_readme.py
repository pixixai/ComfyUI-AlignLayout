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

    # 1. 查找模板中所有的 INCLUDE 标记，用于提取标题和生成链接
    include_pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    includes = re.findall(include_pattern, template_content)

    # 2. 生成目录 (TOC) 字符串
    toc_links = []
    for file_path in includes:
        file_path = file_path.strip()
        if os.path.exists(file_path):
            # 默认使用文件名作为显示名称
            display_name = os.path.splitext(os.path.basename(file_path))[0]
            
            # 尝试从模块文件中提取第一个标题
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                for line in sub_f:
                    header_match = re.match(r'^#+\s+(.*)', line)
                    if header_match:
                        display_name = header_match.group(1).strip()
                        break
            
            # 生成指向文档的链接
            toc_links.append(f"* [📍 {display_name}]({file_path})")
    
    if toc_links:
        # 在目录上方添加一个标题，并换行
        toc_string = "## 🧭 详细文档导航\n\n" + "\n".join(toc_links) + "\n"
    else:
        toc_string = ""

    # 3. 执行替换逻辑
    # 首先：将 <!-- TOC --> 替换为生成的链接列表
    if "<!-- TOC -->" in template_content:
        final_content = template_content.replace("<!-- TOC -->", toc_string)
    else:
        # 如果没有 TOC 标记，则不做目录插入
        final_content = template_content

    # 其次：将所有的 <!-- INCLUDE:xxx --> 标记替换为空字符串，保持 README 干净
    # 这样 template.md 后面的内容（如“联系我们”）会自动上移，保持排版正确
    final_content = re.sub(include_pattern, "", final_content)

    # 4. 写入最终文件
    with open(output_path, 'w', encoding='utf-8') as f:
        # 使用 strip 处理一下首尾多余换行，确保文件美观
        f.write(final_content.strip() + "\n")
    
    print(f"Successfully generated {output_path} based on your template structure.")

if __name__ == "__main__":
    build_readme()