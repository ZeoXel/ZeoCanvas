# 生成歌曲(灵感模式)

# 音乐版本以及生成参数介绍

Suno 版本介绍
提交任务接口中 mv 参数控制 suno 版本
```
{
    "prompt": "",
    "mv": "chirp-v4"
}
```
各版本对应 mv 参数值
|  版本 | mv |
| --- | --- |
|  v3.0 | chirp-v3.0 |
|  v3.5 | chirp-v3.5 |
|  v4.0 | chirp-v4 |
|  v4.5 | chirp-auk |
|  v4.5+ | chirp-bluejay |
|  v5 | chirp-crow |


## 自定义创作模式
### 普通生成
| 参数名            | 类型   | 描述                     | 备注                                                                 |
|------------------|--------|--------------------------|---------------------------------------------------------------------|
| title            | String | 音乐标题                 |                                                                     |
| tags             | String | 音乐风格, 使用半角逗号隔开 |                                                                     |
| generation_type  | String | 生成类型                 | 默认为 TEXT                                                         |
| prompt           | String | 音乐创作提示词, 包括但不限于歌词 |                                                                     |
| negative_tags    | String | 不希望出现的风格         | 可以为空字符串                                                      |
| mv               | String | 模型                     | 默认为 chirp-v4, 可选 chirp-v3-5，chirp-v3-0。非必须参数。当扩展上传的音频文件时，使用 chirp-v3-5-upload |



### 续写
| 参数名            | 类型   | 描述                     | 备注                                                                 |
|------------------|--------|--------------------------|---------------------------------------------------------------------|
| task_id            | String | 续写的前任务id                 |       
| title            | String | 音乐标题                 |                                                                     |
| tags             | String | 音乐风格, 使用半角逗号隔开 |                                                                     |
| generation_type  | String | 生成类型                 | 默认为 TEXT                                                         |
| prompt           | String | 音乐创作提示词, 包括但不限于歌词 |                                                                     |
| negative_tags    | String | 不希望出现的风格         | 可以为空字符串                                                      |
| mv               | String | 模型                     | 默认为 chirp-v4, 可选 chirp-v3-5，chirp-v3-0|
| continue_at      | Float  |                          | 需要继续创作时使用。含义为，从第几秒开始继续创作，例如 120.00 或者 61.59 |
| continue_clip_id | String |                          | 需要继续创作时使用。含义为，需要继续创作的歌曲 id                      |
| task | String |          extend                |   默认为 extend   |



### 上传生成
| 参数名                   | 类型   | 描述                     | 备注                                                       |
|--------------------------|--------|--------------------------|------------------------------------------------------------|
| prompt                   | String | 音乐创作提示词           | 可以为空字符串                                             |
| generation_type          | String | 生成类型                 | 默认为 TEXT                                                |
| tags                     | String | 音乐风格                 | 使用半角逗号隔开                                           |
| negative_tags            | String | 不希望出现的风格         | 可以为空字符串                                             |
| mv                       | String | 模型                     | 请使用 chirp-v3-5-tau                                      |
| title                    | String | 音乐标题                 |                                                            |
| continue_clip_id         | String | 需要继续创作的歌曲id     | 非必传参数，可以为 null                                    |
| continue_at              | Float  | 从第几秒开始继续创作     | 非必传参数，可以为 null                                    |
| continued_aligned_prompt | String | 继续创作的对齐提示词     | 非必传参数，可以为 null                                    |
| infill_start_s           | Float  | 填充开始时间（秒）       | 非必传参数，可以为 null                                    |
| infill_end_s             | Float  | 填充结束时间（秒）       | 非必传参数，可以为 null                                    |
| task                     | String | 任务类型                 | 使用 Cover 功能，所以是 cover                              |
| cover_clip_id            | String | 要翻唱的原曲id，或者上传的音频 clip id | 用于 Cover 功能                                            |
| task_id            | String | 续写的前任务id                 |       



## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /suno/submit/music:
    post:
      summary: 生成歌曲(灵感模式)
      deprecated: false
      description: ''
      tags:
        - 音频接口/Suno文生歌
      parameters:
        - name: accept
          in: header
          description: ''
          required: false
          example: '*/*'
          schema:
            type: string
        - name: content-type
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                mv:
                  type: string
                title:
                  type: string
                tags:
                  type: string
                continue_at:
                  type: integer
                continue_clip_id:
                  type: string
                task:
                  type: string
                make_instrumental:
                  type: boolean
              required:
                - prompt
                - mv
                - title
                - tags
                - continue_at
                - continue_clip_id
                - task
                - make_instrumental
              x-apifox-orders:
                - prompt
                - mv
                - title
                - tags
                - continue_at
                - continue_clip_id
                - task
                - make_instrumental
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
                x-apifox-orders: []
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 音频接口/Suno文生歌
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-290934291-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
# 场景一: 灵感模式

提交都是 post 到 {{BASE_URL}}/suno/generate
获取结果 都是 get {{BASE_URL}}/suno/feed/clipsId1,clipsId2
通过下面 请求体能产生不同的效果

```
curl --request POST \
  --url {{BASE_URL}}/suno/generate \
  --header 'Authorization: Bearer your-key' \
  --header 'Content-Type: application/json' \
  --data '{
  "gpt_description_prompt": "乡愁"
}'
```