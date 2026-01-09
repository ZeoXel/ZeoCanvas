# 查询歌曲

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /suno/fetch/{task_id}:
    get:
      summary: 查询歌曲
      deprecated: false
      description: ''
      tags:
        - 音频接口/Suno文生歌
      parameters:
        - name: task_id
          in: path
          description: 任务ID
          required: true
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
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string
                  data:
                    type: object
                    properties:
                      task_id:
                        type: string
                      notify_hook:
                        type: string
                      action:
                        type: string
                      status:
                        type: string
                      fail_reason:
                        type: string
                      submit_time:
                        type: integer
                      start_time:
                        type: integer
                      finish_time:
                        type: integer
                      progress:
                        type: string
                      data:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: string
                            title:
                              type: string
                            status:
                              type: string
                            metadata:
                              type: object
                              properties:
                                tags:
                                  type: string
                                prompt:
                                  type: string
                                duration:
                                  type: integer
                                error_type:
                                  type: 'null'
                                error_message:
                                  type: 'null'
                                audio_prompt_id:
                                  type: 'null'
                                gpt_description_prompt:
                                  type: string
                              required:
                                - tags
                                - prompt
                                - duration
                                - error_type
                                - error_message
                                - audio_prompt_id
                                - gpt_description_prompt
                              x-apifox-orders:
                                - tags
                                - prompt
                                - duration
                                - error_type
                                - error_message
                                - audio_prompt_id
                                - gpt_description_prompt
                            audio_url:
                              type: string
                            image_url:
                              type: string
                            video_url:
                              type: string
                            model_name:
                              type: string
                            image_large_url:
                              type: string
                            major_model_version:
                              type: string
                          required:
                            - id
                            - title
                            - status
                            - metadata
                            - audio_url
                            - image_url
                            - video_url
                            - model_name
                            - image_large_url
                            - major_model_version
                          x-apifox-orders:
                            - id
                            - title
                            - status
                            - metadata
                            - audio_url
                            - image_url
                            - video_url
                            - model_name
                            - image_large_url
                            - major_model_version
                    required:
                      - task_id
                      - notify_hook
                      - action
                      - status
                      - fail_reason
                      - submit_time
                      - start_time
                      - finish_time
                      - progress
                      - data
                    x-apifox-orders:
                      - task_id
                      - notify_hook
                      - action
                      - status
                      - fail_reason
                      - submit_time
                      - start_time
                      - finish_time
                      - progress
                      - data
                required:
                  - code
                  - message
                  - data
                x-apifox-orders:
                  - code
                  - message
                  - data
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 音频接口/Suno文生歌
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-294776598-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```