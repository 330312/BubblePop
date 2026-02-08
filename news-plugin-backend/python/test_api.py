import os
from zhipuai import ZhipuAI

api_key = (
    os.environ.get("ZAI_API_KEY")
    or os.environ.get("ZHIPU_API_KEY")
    or os.environ.get("GLM_API_KEY")
)
if not api_key:
    raise RuntimeError("Missing API key in env (ZAI_API_KEY / ZHIPU_API_KEY / GLM_API_KEY)")

client = ZhipuAI(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[{"role": "user", "content": "hi"}]
    )
    print("Success:", response.choices[0].message.content)
except Exception as e:
    print("Error:", e)
