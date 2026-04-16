import os
from openai import OpenAI

# 注意: 不同地域的base_url不通用（下方示例使用新加坡地域的base_url）
# - 新加坡: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
# - 美国（弗吉尼亚）: https://dashscope-us.aliyuncs.com/compatible-mode/v1
# - 中国北京: https://dashscope.aliyuncs.com/compatible-mode/v1
# - 中国香港：https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1
# - 德国（法兰克福）: https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/compatible-mode/v1，请将WorkspaceId替换为业务空间ID
client = OpenAI(
    api_key="s123123123", 
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
completion = client.chat.completions.create(
    model="qwen3.5-plus",
    messages=[{"role": "user", "content": "你是谁？"}]
)
print(completion.choices[0].message.content)