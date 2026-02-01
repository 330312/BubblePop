import os
from zhipuai import ZhipuAI

api_key = "5bba23796f0348a786c72b16c4639579.m6qMYAQNwicVwKkc"
client = ZhipuAI(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[{"role": "user", "content": "hi"}]
    )
    print("Success:", response.choices[0].message.content)
except Exception as e:
    print("Error:", e)
