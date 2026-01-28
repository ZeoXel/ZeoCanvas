# Veo 视频生成 500 错误诊断报告

## 问题概述
Veo 视频生成功能返回 500 错误，无法创建视频生成任务。

## 测试环境
- **网关地址**: https://api.lsaigc.com
- **API Key**: sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw
- **测试时间**: 2026-01-28

## 测试结果

### 1. 网关连接测试
✅ **通过** - API Key 有效，可以获取模型列表

```bash
curl -X GET "https://api.lsaigc.com/v1/models" \
  -H "Authorization: Bearer sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw"
# 返回: 包含 veo3.1, viduq2-turbo 等模型
```

### 2. Veo API 测试（JSON 格式）
❌ **失败** - 返回 500 错误

```bash
# 请求
POST /v1/video/generations
Content-Type: application/json
{
  "model": "veo3.1",
  "prompt": "测试视频生成",
  "aspect_ratio": "16:9",
  "duration": 5
}

# 响应
Status: 500
{
  "code": "build_request_failed",
  "message": "failed to parse multipart form",
  "data": null
}
```

**问题**: 网关期望 `multipart/form-data` 格式，但代码发送的是 JSON

### 3. Veo API 测试（Multipart 格式）
❌ **失败** - 返回 400 错误

```bash
# 请求
POST /v1/video/generations
Content-Type: multipart/form-data
model=veo3.1
prompt=测试视频
aspect_ratio=16:9
duration=5

# 响应
Status: 400
{
  "error": {
    "code": "",
    "message": "未指定模型名称，模型名称不能为空",
    "type": "new_api_error"
  }
}
```

**问题**: 即使使用 multipart 格式，网关仍然无法识别模型字段

### 4. 其他视频服务测试
- **Vidu (viduq2-turbo)**: ❌ 返回 "model is not supported"
- **Seedance**: ❌ 返回 "invalid api platform: 45"

## 根本原因

网关的 `/v1/video/generations` 端点配置错误：

1. **格式不匹配**:
   - 根据 API 文档，应该使用 `/v2/videos/generations` 端点和 JSON 格式
   - 但网关的 `/v1/video/generations` 端点要求 multipart 格式

2. **字段验证问题**:
   - 即使使用 multipart 格式，网关也无法正确解析 `model` 字段
   - 可能是字段名映射错误或验证逻辑有 bug

3. **端点不存在**:
   - 文档中的 `/v2/videos/generations` 端点在网关上返回 HTML 页面（404）

## 解决方案

### 方案 1: 修复网关配置（推荐）

联系网关管理员，修复 `/v1/video/generations` 端点：

1. **支持 JSON 格式**（根据 API 文档）
2. **或者正确处理 multipart 格式**的模型字段验证
3. **添加 `/v2/videos/generations` 端点**（根据最新文档）

### 方案 2: 代码适配（临时方案）

如果网关短期内无法修复，可以：

1. **使用其他可用的视频服务**（如果有）
2. **直接调用 Veo 原始 API**（需要 Veo 的直接访问凭证）
3. **等待网关修复后再启用 Veo 功能**

### 方案 3: 网关路由调试

检查网关是否有特殊的路由规则或参数要求：

```javascript
// 可能需要的额外参数
{
  "model": "veo3.1",
  "prompt": "测试",
  "images": [],  // 文档说这是必需字段
  "aspect_ratio": "16:9"
}
```

## 建议的下一步

1. **联系网关管理员**，提供此诊断报告
2. **确认正确的 API 端点和格式**
3. **获取网关的 API 文档**（如果有）
4. **测试其他视频服务**是否有相同问题

## 相关文件

- `/Users/g/Desktop/探索/studio/src/services/providers/veo.ts` - Veo 服务实现
- `/Users/g/Desktop/探索/studio/src/app/api/studio/video/route.ts` - 视频 API 路由
- `/Users/g/Desktop/探索/studio/test-veo-api.js` - 测试脚本

## 测试脚本

运行以下命令重现问题：

```bash
node test-veo-api.js
```
