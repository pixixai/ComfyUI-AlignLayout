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
        """
        修复 Markdown 中的图片相对路径。
        将 ![alt](image.png) 转换为 ![alt](base_dir/image.png)
        """
        # 匹配 ![alt](path) 但排除网络链接 (http/https)
        img_pattern = r'!\[(.*?)\]\((?!http)(.*?)\)'
        
        def img_replace(match):
            alt_text = match.group(1)
            img_path = match.group(2).strip()
            # 拼接正确的路径
            new_path = os.path.join(base_dir, img_path).replace("\\", "/")
            return f'![{alt_text}]({new_path})'
            
        return re.sub(img_pattern, img_replace, text)

    def replace_match(match):
        file_path = match.group(1).strip()
        
        if os.path.exists(file_path):
            print(f"Including content from: {file_path}")
            # 获取该模块文件所在的目录，用于修复图片路径
            module_dir = os.path.dirname(file_path)
            
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                sub_content = sub_f.read()
                # 核心：修复图片路径后再返回
                fixed_content = fix_image_paths(sub_content, module_dir)
                return f"\n{fixed_content}\n"
        else:
            print(f"Warning: File {file_path} not found.")
            return f"<!-- Error: {file_path} not found -->"

    # 执行替换逻辑
    new_content = re.sub(pattern, replace_match, content)

    # 写入最终的 README.md
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully generated README.md with fixed image paths.")

if __name__ == "__main__":
    build_readme()