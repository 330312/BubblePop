FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

WORKDIR /app

# 安装 Node.js 18 (npmmirror 国内镜像)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://npmmirror.com/mirrors/node/v18.20.5/node-v18.20.5-linux-x64.tar.gz -o /tmp/node.tar.gz && \
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 && \
    rm /tmp/node.tar.gz && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 复制整个项目
COPY . /app/

# 安装 Python 依赖
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple \
    -r news-plugin-backend/requirements.txt

# 安装 Node.js 依赖
WORKDIR /app/news-plugin-backend
RUN npm install --registry=https://registry.npmmirror.com

# 环境变量
ENV PORT=7860 \
    CORS_ORIGINS=* \
    DDG_REGION=cn-zh \
    DDG_BACKEND=auto \
    DDG_TIMEOUT_MS=12000 \
    GDELT_TIMEOUT_MS=8000 \
    GDELT_INSECURE=0 \
    AGENT_MODE=process \
    AGENT_RUNNER=python/agent_runner.py \
    AGENT_TIMEOUT_MS=120000 \
    SEARCH_PYTHON=python3

EXPOSE 7860
ENTRYPOINT ["node", "src/server.js"]
