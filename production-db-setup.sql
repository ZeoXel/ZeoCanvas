-- 生产环境数据库配置脚本
-- 用于配置Veo和Seedance渠道
-- 数据库类型: PostgreSQL
-- 连接信息: postgresql://postgres:XvYzKZaXEBPujkRBAwgbVbScazUdwqVY@yamanote.proxy.rlwy.net:56740/railway

-- 0. 添加vendors配置
INSERT INTO vendors (id, name, description, icon, status, created_time, updated_time)
VALUES
  (54, 'Veo', 'Google Veo视频生成', 'Veo', 1, EXTRACT(EPOCH FROM NOW())::INTEGER, EXTRACT(EPOCH FROM NOW())::INTEGER),
  (56, 'Seedance', '火山引擎Seedance视频生成', 'Seedance', 1, EXTRACT(EPOCH FROM NOW())::INTEGER, EXTRACT(EPOCH FROM NOW())::INTEGER)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_time = EXTRACT(EPOCH FROM NOW())::INTEGER;

-- 1. 更新Seedance渠道 (假设已存在channel 4)
-- 将type从45 (VolcEngine通用) 改为56 (Seedance专用)
UPDATE channels
SET type = 56,
    base_url = 'https://ark.cn-beijing.volces.com',
    models = 'doubao-seedream-4-5-251128,doubao-seedance-1-5-pro-251215'
WHERE id = 4;

-- 2. 创建Veo渠道 (如果不存在)
-- 注意：需要替换 'YOUR_VEO_API_KEY' 为实际的API密钥
INSERT INTO channels (
    id, type, key, status, name, weight,
    base_url, models, "group", priority, auto_ban, channel_ratio
) VALUES (
    6, 54, 'YOUR_VEO_API_KEY', 1, 'Veo', 0,
    '', 'veo3.1,veo3', 'default', 0, 1, 1.0
)
ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    name = EXCLUDED.name,
    models = EXCLUDED.models;

-- 3. 添加Veo模型到abilities表 (如果需要)
-- 注意：需要根据实际的group和channel_id调整
INSERT INTO abilities (group_name, model, channel_id, enabled, priority)
SELECT 'default', 'veo3.1', 6, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM abilities WHERE model = 'veo3.1' AND channel_id = 6);

INSERT INTO abilities (group_name, model, channel_id, enabled, priority)
SELECT 'default', 'veo3', 6, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM abilities WHERE model = 'veo3' AND channel_id = 6);

-- 4. 添加Seedance模型到abilities表
INSERT INTO abilities (group_name, model, channel_id, enabled, priority)
SELECT 'default', 'doubao-seedance-1-5-pro-251215', 4, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM abilities WHERE model = 'doubao-seedance-1-5-pro-251215' AND channel_id = 4);

INSERT INTO abilities (group_name, model, channel_id, enabled, priority)
SELECT 'default', 'doubao-seedream-4-5-251128', 4, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM abilities WHERE model = 'doubao-seedream-4-5-251128' AND channel_id = 4);

-- 验证配置
SELECT '=== Veo和Seedance渠道配置 ===' as info;
SELECT id, name, type, base_url, models, status FROM channels WHERE type IN (54, 56);

SELECT '=== 相关模型配置 ===' as info;
SELECT group_name, model, channel_id, enabled FROM abilities WHERE channel_id IN (4, 6);
