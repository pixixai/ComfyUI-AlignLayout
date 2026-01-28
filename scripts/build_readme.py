import re
import os

def build_readme():
    # --- 【配置区】：路径已更新为 docs 目录 ---
    template_path = 'docs/template.md'  # 模板现在在 docs 文件夹内
    output_path = 'README.md'           # 最终生成的 README 仍在根目录
    
    if not os.path.exists(template_path):
        print(f"错误: 找不到模板文件 {template_path}")
        return

    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配标记格式: <!-- INCLUDE:docs/modules/2.md -->
    pattern = r'<!--\s*INCLUDE:(.*?)\s*-->'
    
    def replace_match(match):
        # 获取匹配到的文件路径
        file_path = match.group(1).strip()
        
        if os.path.exists(file_path):
            print(f"正在合并内容: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as sub_f:
                return f"\n{sub_f.read()}\n"
        else:
            print(f"警告: 找不到文件 {file_path}")
            return f"<!-- 错误: 找不到文件 {file_path} -->"

    # 执行替换
    new_content = re.sub(pattern, replace_match, content)

    # 写入根目录的 README.md
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("README.md 同步完成！")

if __name__ == "__main__":
    build_readme()