# 同步语音合成

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/t2a_v2:
    post:
      summary: 同步语音合成
      deprecated: false
      description: |-
        [官方文档](https://platform.minimaxi.com/docs/api-reference/speech-t2a-http)

        通过提交 post请求{{BASE_URL}}/minimaxi/v1/voice_design
        并同步得到结果
      tags:
        - 音频接口/MINIMAX 语音合成
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: true
          example: <content-type>
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
            model: speech-2.6-hd
            text: 今天是不是很开心呀，当然了！
            stream: false
            voice_setting:
              voice_id: male-qn-qingse
              speed: 1
              vol: 1
              pitch: 0
              emotion: happy
            pronunciation_dict:
              tone:
                - 处理/(chu3)(li3)
                - 危险/dangerous
            audio_setting:
              sample_rate: 32000
              bitrate: 128000
              format: mp3
              channel: 1
            subtitle_enable: false
            schema:
              type: object
              properties:
                model:
                  type: string
                  description: >-
                    请求的模型版本，可选范围：speech-2.6-hd, speech-2.6-turbo, speech-02-hd,
                    speech-02-turbo, speech-01-hd, speech-01-turbo.
                text:
                  type: string
                  description: 需要合成语音的文本
                stream:
                  type: boolean
                  description: 控制是否流式输出。默认 false，即不开启流式
                voice_setting:
                  type: object
                  properties:
                    voice_id:
                      type: string
                    speed:
                      type: number
                      description: 合成音频的语速，取值越大，语速越快。取值范围 [0.5,2]，默认值为1.0
                    vol:
                      type: number
                      description: 合成音频的音量，取值越大，音量越高。取值范围 (0,10]，默认值为 1.0
                    pitch:
                      type: integer
                      description: 合成音频的语调，取值范围 [-12,12]，默认值为 0，其中 0 为原音色输出
                    emotion:
                      type: string
                      description: >-
                        控制合成语音的情绪，参数范围 ["happy", "sad", "angry", "fearful",
                        "disgusted", "surprised", "calm", "fluent"]，分别对应 8
                        种情绪：高兴，悲伤，愤怒，害怕，厌恶，惊讶，中性，生动


                        模型会根据输入文本自动匹配合适的情绪，一般无需手动指定

                        该参数仅对 speech-2.6-hd, speech-2.6-turbo, speech-02-hd,
                        speech-02-turbo, speech-01-hd, speech-01-turbo 模型生效

                        选项 fluent 仅对 speech-2.6-turbo, speech-2.6-hd 模型生效

                        可用选项: happy, sad, angry, fearful, disgusted, surprised,
                        calm, fluent 
                    text_normalization:
                      type: boolean
                      description: 是否启用中文、英语文本规范化，开启后可提升数字阅读场景的性能，但会略微增加延迟，默认值为 false
                    latex_read:
                      type: boolean
                      description: 控制是否朗读 latex 公式，默认为 false
                  required:
                    - voice_id
                  x-apifox-orders:
                    - voice_id
                    - speed
                    - vol
                    - pitch
                    - emotion
                    - text_normalization
                    - latex_read
                pronunciation_dict:
                  type: object
                  properties:
                    tone:
                      type: array
                      items:
                        type: string
                        description: |-
                          定义需要特殊标注的文字或符号对应的注音或发音替换规则。在中文文本中，声调用数字表示：
                          一声为 1，二声为 2，三声为 3，四声为 4，轻声为 5
                          示例如下：
                          ["燕少飞/(yan4)(shao3)(fei1)", "omg/oh my god"]
                  x-apifox-orders:
                    - tone
                audio_setting:
                  type: object
                  properties:
                    sample_rate:
                      type: integer
                      description: >-
                        生成音频的采样率。可选范围[8000，16000，22050，24000，32000，44100]，默认为
                        32000
                    bitrate:
                      type: integer
                      description: >-
                        生成音频的比特率。可选范围[32000，64000，128000，256000]，默认值为
                        128000。该参数仅对 mp3 格式的音频生效
                    format:
                      type: string
                      description: |-
                        生成音频的格式，wav 仅在非流式输出下支持

                        可用选项: mp3, pcm, flac, wav 
                    channel:
                      type: integer
                      description: 生成音频的声道数。可选范围：[1,2]，其中 1 为单声道，2 为双声道，默认值为 1
                    force_cbr:
                      type: boolean
                      description: >-
                        对于音频恒定比特率（cbr）控制，可选 false、 true。当此参数设置为
                        true，将以恒定比特率方式进行音频编码。

                        注意：本参数仅当音频设置为流式输出，且音频格式为 mp3 时生效。
                  x-apifox-orders:
                    - sample_rate
                    - bitrate
                    - format
                    - channel
                    - force_cbr
                subtitle_enable:
                  type: boolean
                stream_options:
                  type: object
                  properties:
                    exclude_aggregated_audio:
                      type: string
                      description: >-
                        设置最后一个 chunk 是否包含拼接后的语音 hex 数据。默认值为 False，即最后一个 chunk
                        中包含拼接后的完整语音 hex 数据
                  x-apifox-orders:
                    - exclude_aggregated_audio
                  required:
                    - exclude_aggregated_audio
                timber_weights:
                  type: object
                  properties:
                    ' voice_id':
                      type: string
                    weight:
                      type: integer
                      description: >-
                        合成音频各音色所占的权重，须与 voice_id 同步填写。可选值范围为[1, 100]，最多支持 4
                        种音色混合，单一音色取值占比越高，合成音色与该音色相似度越高.             
                  x-apifox-orders:
                    - ' voice_id'
                    - weight
                  required:
                    - ' voice_id'
                    - weight
                language_boost:
                  type: string
                  description: >-
                    是否增强对指定的小语种和方言的识别能力。默认值为 null，可设置为 auto 让模型自主判断。


                    可用选项: Chinese, Chinese,Yue, English, Arabic, Russian,
                    Spanish, French, Portuguese, German, Turkish, Dutch,
                    Ukrainian, Vietnamese, Indonesian, Japanese, Italian,
                    Korean, Thai, Polish, Romanian, Greek, Czech, Finnish,
                    Hindi, Bulgarian, Danish, Hebrew, Malay, Persian, Slovak,
                    Swedish, Croatian, Filipino, Hungarian, Norwegian,
                    Slovenian, Catalan, Nynorsk, Tamil, Afrikaans, auto 
                voice_modify:
                  type: object
                  properties:
                    pitch:
                      type: integer
                      description: |+
                        音高调整（低沉/明亮），范围 [-100,100]，数值接近 -100，声音更低沉；接近 100，声音更明亮

                    intensity:
                      type: integer
                      description: |+
                        强度调整（力量感/柔和），范围 [-100,100]，数值接近 -100，声音更刚劲；接近 100，声音更轻柔

                    timbre:
                      type: integer
                      description: |+
                        音色调整（磁性/清脆），范围 [-100,100]，数值接近 -100，声音更浑厚；数值接近 100，声音更清脆

                    sound_effects:
                      type: string
                      description: >-
                        音效设置，单次仅能选择一种，可选值：


                        spacious_echo（空旷回音）

                        auditorium_echo（礼堂广播）

                        lofi_telephone（电话失真）

                        robotic（电音）

                        可用选项: spacious_echo, auditorium_echo, lofi_telephone,
                        robotic 
                  x-apifox-orders:
                    - pitch
                    - intensity
                    - timbre
                    - sound_effects
                  description: |-
                    声音效果器设置，该参数支持的音频格式：

                    非流式：mp3, wav, flac
                    流式：mp3
                ' subtitle_enable':
                  type: boolean
                  description: >-
                    控制是否开启字幕服务，默认值为 false。此参数仅在非流式输出场景下有效，且仅对 speech-2.6-hd
                    speech-2.6-turbo speech-02-turbo speech-02-hd
                    speech-01-turbo speech-01-hd 模型有效
                output_format:
                  type: string
                  description: >-
                    控制输出结果形式的参数，可选值范围为[url, hex]，默认值为 hex
                    。该参数仅在非流式场景生效，流式场景仅支持返回 hex 形式。返回的 url 有效期为 24 小时


                    可用选项: url, hex 
                aigc_watermark:
                  type: boolean
                  description: 控制在合成音频的末尾添加音频节奏标识，默认值为 False。该参数仅对非流式合成生效
              required:
                - model
                - text
                - voice_setting
              x-apifox-orders:
                - model
                - text
                - stream
                - voice_setting
                - pronunciation_dict
                - audio_setting
                - subtitle_enable
                - stream_options
                - timber_weights
                - language_boost
                - voice_modify
                - ' subtitle_enable'
                - output_format
                - aigc_watermark
            example:
              model: speech-2.6-hd
              text: 今天是不是很开心呀，当然了！
              stream: false
              voice_setting:
                voice_id: male-qn-qingse
                speed: 1
                vol: 1
                pitch: 0
                emotion: happy
              pronunciation_dict:
                tone:
                  - 处理/(chu3)(li3)
                  - 危险/dangerous
              audio_setting:
                sample_rate: 32000
                bitrate: 128000
                format: mp3
                channel: 1
              subtitle_enable: false
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      audio:
                        type: string
                        description: 合成后的音频数据，采用 hex 编码，格式与请求中指定的输出格式一致
                      status:
                        type: integer
                        description: 当前音频流状态：1 表示合成中，2 表示合成结束
                      subtitle_file:
                        type: string
                        description: 合成的字幕下载链接。音频文件对应的字幕，精确到句（不超过 50 字），单位为毫秒，格式为 json
                    x-apifox-orders:
                      - audio
                      - status
                      - subtitle_file
                    description: 返回的合成数据对象，可能为 null，需进行非空判断
                  extra_info:
                    type: object
                    properties:
                      audio_length:
                        type: integer
                        description: 音频时长（毫秒）
                      audio_sample_rate:
                        type: integer
                        description: 音频采样率
                      audio_size:
                        type: integer
                        description: 音频文件大小（字节）
                      bitrate:
                        type: integer
                        description: 音频比特率
                      word_count:
                        type: integer
                        description: 已发音的字数统计，包含汉字、数字、字母，不包含标点符号
                      invisible_character_ratio:
                        type: integer
                        description: >-
                          非法字符占比.非法字符不超过 10%（包含 10%），音频会正常生成,并返回非法字符占比数据；如超过 10%
                          将进行报错
                      usage_characters:
                        type: integer
                        description: 计费字符数
                      audio_format:
                        type: string
                        description: 生成音频文件的格式。取值范围 [mp3, pcm, flac]
                      audio_channel:
                        type: integer
                        description: 生成音频声道数,1：单声道，2：双声道
                    x-apifox-orders:
                      - audio_length
                      - audio_sample_rate
                      - audio_size
                      - bitrate
                      - word_count
                      - invisible_character_ratio
                      - usage_characters
                      - audio_format
                      - audio_channel
                  trace_id:
                    type: string
                  base_resp:
                    type: object
                    properties:
                      status_code:
                        type: integer
                        description: |-
                          状态码。

                          0: 请求结果正常
                          1000: 未知错误
                          1001: 超时
                          1002: 触发限流
                          1004: 鉴权失败
                          1039: 触发 TPM 限流
                          1042: 非法字符超过 10%
                          2013: 输入参数信息不正常
                      status_msg:
                        type: string
                        description: 状态详情
                    required:
                      - status_code
                      - status_msg
                    x-apifox-orders:
                      - status_code
                      - status_msg
                x-apifox-orders:
                  - data
                  - extra_info
                  - trace_id
                  - base_resp
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 音频接口/MINIMAX 语音合成
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-379964423-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
# 创建异步语音合成任务

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/t2a_async_v2:
    post:
      summary: 创建异步语音合成任务
      deprecated: false
      description: >-
        [官方文档](https://platform.minimaxi.com/docs/api-reference/speech-t2a-async-create)


        通过 post 请求{{BASE_URL}}/minimaxi/v1/t2a_async_v2

        创建语音合成任务，并立即返回task_id等相关信息
      tags:
        - 音频接口/MINIMAX 语音合成
      parameters:
        - name: Content-Type
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
                model:
                  type: string
                  description: >-
                    请求的模型版本，可选范围：speech-2.6-hd, speech-2.6-turbo, speech-02-hd,
                    speech-02-turbo, speech-01-hd, speech-01-turbo.
                text:
                  type: string
                  description: 待合成音频的文本，限制最长 5 万字符。和 text_file_id 二选一必填
                language_boost:
                  type: string
                  description: >-
                    是否增强对指定的小语种和方言的识别能力。默认值为 null，可设置为 auto 让模型自主判断。


                    可用选项: Chinese, Chinese,Yue, English, Arabic, Russian,
                    Spanish, French, Portuguese, German, Turkish, Dutch,
                    Ukrainian, Vietnamese, Indonesian, Japanese, Italian,
                    Korean, Thai, Polish, Romanian, Greek, Czech, Finnish,
                    Hindi, Bulgarian, Danish, Hebrew, Malay, Persian, Slovak,
                    Swedish, Croatian, Filipino, Hungarian, Norwegian,
                    Slovenian, Catalan, Nynorsk, Tamil, Afrikaans, auto
                voice_setting:
                  type: object
                  properties:
                    voice_id:
                      type: string
                      description: 合成音频的音色编号。
                    speed:
                      type: number
                      description: 合成音频的语速，取值越大，语速越快。取值范围 [0.5,2]，默认值为1.0
                    vol:
                      type: number
                      description: 合成音频的音量，取值越大，音量越高。取值范围 (0,10]，默认值为 1.0
                    pitch:
                      type: integer
                      description: 合成音频的语调，取值范围 [-12,12]，默认值为 0，其中 0 为原音色输出
                  required:
                    - voice_id
                  x-apifox-orders:
                    - voice_id
                    - speed
                    - vol
                    - pitch
                pronunciation_dict:
                  type: object
                  properties:
                    tone:
                      type: array
                      items:
                        type: string
                      description: |-
                        定义需要特殊标注的文字或符号对应的注音或发音替换规则。在中文文本中，声调用数字表示：
                        一声为 1，二声为 2，三声为 3，四声为 4，轻声为 5
                        示例如下：
                        ["燕少飞/(yan4)(shao3)(fei1)", "omg/oh my god"]
                  x-apifox-orders:
                    - tone
                audio_setting:
                  type: object
                  properties:
                    audio_sample_rate:
                      type: integer
                      description: >-
                        生成音频的采样率。可选范围 [8000，16000，22050，24000，32000，44100]，默认为
                        32000
                    bitrate:
                      type: integer
                      description: >-
                        生成音频的比特率。可选范围 [32000，64000，128000，256000]，默认值为
                        128000。该参数仅对 mp3 格式的音频生效
                    format:
                      type: string
                      description: |-
                        生成音频的格式。可选范围[mp3, pcm, flac]，默认值为 mp3

                        可用选项: mp3, pcm, flac
                    channel:
                      type: integer
                      description: 生成音频的声道数。可选范围：[1,2]，其中 1 为单声道，2 为双声道，默认值为 1
                  x-apifox-orders:
                    - audio_sample_rate
                    - bitrate
                    - format
                    - channel
                voice_modify:
                  type: object
                  properties:
                    pitch:
                      type: integer
                      description: 音高调整（低沉/明亮），范围 [-100,100]，数值接近 -100，声音更低沉；接近 100，声音更明亮
                    intensity:
                      type: integer
                      description: 强度调整（力量感/柔和），范围 [-100,100]，数值接近 -100，声音更刚劲；接近 100，声音更轻柔
                    timbre:
                      type: integer
                      description: 音色调整（磁性/清脆），范围 [-100,100]，数值接近 -100，声音更浑厚；数值接近 100，声音更清脆
                    sound_effects:
                      type: string
                      description: >-
                        音效设置，单次仅能选择一种，可选值：


                        spacious_echo（空旷回音）

                        auditorium_echo（礼堂广播）

                        lofi_telephone（电话失真）

                        robotic（电音）

                        可用选项: spacious_echo, auditorium_echo, lofi_telephone,
                        robotic
                  x-apifox-orders:
                    - pitch
                    - intensity
                    - timbre
                    - sound_effects
                  description: 声音效果器设置
                text_file_id:
                  type: integer
                  description: >-
                    待合成音频的文本文件 待合成音频的文本文件 id，单个文件长度限制小于 10 万字符，支持的文件格式：txt、zip。和
                    text 二选一必填，传入后自动校验格式。


                    txt 文件：长度限制 <100,000 字符。支持使用 <#x#> 标记自定义停顿。x 为停顿时长（单位：秒），范围
                    [0.01,99.99]，最多保留两位小数。注意停顿需设置在两个可以语音发音的文本之间，不可连续使用多个停顿标记

                    zip 文件：

                    压缩包内需包含同一格式的 txt 或 json 文件。

                    json 文件格式：支持 [title, content, extra]
                    三个字段，分别表示标题、正文、附加信息。若三个字段都存在，则产出 3 组结果，共 9
                    个文件，统一存放在一个文件夹中。若某字段不存在或内容为空，则该字段不会生成对应结果
                aigc_watermark:
                  type: boolean
                  description: 控制在合成音频的末尾添加音频节奏标识，默认值为 False。该参数仅对非流式合成生效
              required:
                - model
                - text
                - voice_setting
                - text_file_id
              x-apifox-orders:
                - model
                - text
                - language_boost
                - voice_setting
                - pronunciation_dict
                - audio_setting
                - voice_modify
                - text_file_id
                - aigc_watermark
            example:
              model: speech-2.6-hd
              text: 真正的危险不是计算机开始像人一样思考，而是人开始像计算机一样思考。计算机只是可以帮我们处理一些简单事务。
              language_boost: auto
              voice_setting:
                voice_id: audiobook_male_1
                speed: 1
                vol: 1
                pitch: 1
              pronunciation_dict:
                tone:
                  - 危险/dangerous
              audio_setting:
                audio_sample_rate: 32000
                bitrate: 128000
                format: mp3
                channel: 2
              voice_modify:
                pitch: 0
                intensity: 0
                timbre: 0
                sound_effects: spacious_echo
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  task_id:
                    type: integer
                    description: 当前任务的 ID
                  task_token:
                    type: string
                    description: 完成当前任务使用的密钥信息
                  file_id:
                    type: integer
                    description: >-
                      任务创建成功后返回的对应音频文件的 ID。


                      当任务完成后，可通过 file_id 调用 文件检索接口 进行下载

                      当请求出错时，不返回该字段 注意：返回的下载 URL 自生成起 9 小时（32,400
                      秒）内有效，过期后文件将失效，生成的信息便会丢失，请注意下载信息的时间
                  usage_characters:
                    type: integer
                    description: 计费字符数
                  base_resp:
                    type: object
                    properties:
                      status_code:
                        type: integer
                        description: |-
                          状态码

                          0: 正常
                          1002: 限流
                          1004: 鉴权失败
                          1039: 触发 TPM 限流
                          1042: 非法字符超10%
                          2013: 参数错误
                      status_msg:
                        type: string
                        description: 状态详情
                    required:
                      - status_code
                      - status_msg
                    x-apifox-orders:
                      - status_code
                      - status_msg
                    description: 本次请求的状态码及其详情
                x-apifox-orders:
                  - task_id
                  - task_token
                  - file_id
                  - usage_characters
                  - base_resp
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 音频接口/MINIMAX 语音合成
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-379965171-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
# 查询语音生成任务状态

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/query/t2a_async_query_v2:
    get:
      summary: 查询语音生成任务状态
      deprecated: false
      description: >-
        [官方文档](https://platform.minimaxi.com/docs/api-reference/speech-t2a-async-query)


        通过异步请求得到的 task_id, get
        请求{{BASE_URL}}/minimaxi/v1/query/t2a_async_query_v2

        并提交task_id来获得获得任务完成情况
      tags:
        - 音频接口/MINIMAX 语音合成
      parameters:
        - name: task_id
          in: query
          description: ''
          required: true
          example: 95157322514444
          schema:
            type: integer
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  task_id:
                    type: integer
                    description: 任务 ID，提交任务时返回的信息
                  status:
                    type: string
                    description: |-
                      该任务的当前状态。

                      Processing: 该任务正在处理中
                      Success: 该任务已完成
                      Failed: 任务失败
                      Expired: 任务已过期
                      可用选项: success, failed, expired, processing
                  file_id:
                    type: integer
                    description: >-
                      任务创建成功后返回的对应音频文件的 ID。


                      当任务完成后，可通过 file_id 调用 文件检索接口 进行下载

                      当请求出错时，不返回该字段 注意：返回的下载 URL 自生成起 9 小时（32,400
                      秒）内有效，过期后文件将失效，生成的信息便会丢失，请注意下载信息的时间
                  base_resp:
                    type: object
                    properties:
                      status_code:
                        type: integer
                        description: |-
                          状态码

                          0: 正常
                          1002: 限流
                          1004: 鉴权失败
                          1039: 触发 TPM 限流
                          1042: 非法字符超10%
                          2013: 参数错误
                      status_msg:
                        type: string
                        description: 状态详情
                    required:
                      - status_code
                      - status_msg
                    x-apifox-orders:
                      - status_code
                      - status_msg
                    description: 本次请求的状态码及其详情
                required:
                  - task_id
                  - status
                  - file_id
                x-apifox-orders:
                  - task_id
                  - status
                  - file_id
                  - base_resp
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 音频接口/MINIMAX 语音合成
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-379966857-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```