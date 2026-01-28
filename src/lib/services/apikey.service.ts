import { supabaseAdmin } from '@/lib/supabase'
import { Database } from '@/lib/supabase'

type ApiKey = Database['public']['Tables']['api_keys']['Row']
type CreateApiKeyData = Database['public']['Tables']['api_keys']['Insert']
type UpdateApiKeyData = Database['public']['Tables']['api_keys']['Update']

export class ApiKeyService {
  // 生成新的密钥ID，优先填补缺失的序号，然后按顺序递增
  // 格式为A000001, A000002... (A000000保留给超级管理员)
  private static async generateKeyId(): Promise<string> {
    const { data: existingKeys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id')
      .order('id', { ascending: true }) // 按ID排序

    if (error) {
      // 如果查询失败，从A000001开始
      return 'A000001'
    }

    // 提取所有A000000格式的数字ID
    const existingNumbers = new Set<number>()
    existingKeys.forEach(key => {
      if (key.id.startsWith('A') && key.id.length === 7) {
        const numberPart = parseInt(key.id.substring(1))
        if (!isNaN(numberPart)) {
          existingNumbers.add(numberPart)
        }
      }
    })

    // 从1开始查找第一个缺失的序号（0保留给A000000）
    for (let i = 1; i <= existingNumbers.size + 1; i++) {
      if (!existingNumbers.has(i)) {
        return 'A' + i.toString().padStart(6, '0')
      }
    }

    // 如果没有缺失的序号，返回下一个最大的序号
    const maxNumber = Math.max(...Array.from(existingNumbers), 0)
    return 'A' + (maxNumber + 1).toString().padStart(6, '0')
  }

  // 检查密钥ID格式
  static isLegacyFormat(id: string): boolean {
    // UUID格式检查
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidPattern.test(id)
  }

  static isNewFormat(id: string): boolean {
    // A000000格式检查
    const newPattern = /^A[0-9]{6}$/
    return newPattern.test(id)
  }

  // 获取所有密钥
  static async getAllApiKeys(): Promise<ApiKey[]> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .order('id', { ascending: true }) // 按ID排序

    if (error) {
      throw new Error('获取密钥列表失败')
    }

    return data || []
  }

  // 获取API密钥显示视图（包含用户友好ID）
  static async getAllApiKeysWithUserDisplay(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('api_key_user_display')
      .select('*')
      .order('key_id', { ascending: true })

    if (error) {
      throw new Error('获取API密钥显示列表失败')
    }

    return data || []
  }

  // 获取可用的密钥
  static async getAvailableApiKeys(): Promise<ApiKey[]> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('status', 'active') // 使用数据库实际的状态值
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error('获取可用密钥失败')
    }

    return data || []
  }

  // 根据ID获取密钥
  static async getApiKeyById(id: string): Promise<ApiKey | null> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 密钥不存在
      }
      throw new Error('获取密钥失败')
    }

    return data
  }

  // 根据用户ID获取分配的密钥
  static async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('assigned_user_id', userId)
      .order('assigned_at', { ascending: false })

    if (error) {
      throw new Error('获取用户密钥失败')
    }

    return data || []
  }

  // 获取用户当前分配的密钥值
  static async getAssignedKeyValueByUserId(userId: string, provider?: string): Promise<string | null> {
    let query = supabaseAdmin
      .from('api_keys')
      .select('key_value, provider, status')
      .eq('assigned_user_id', userId)
      .eq('status', 'assigned')
      .order('assigned_at', { ascending: false })
      .limit(1)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) {
      console.error('获取用户密钥失败:', error)
      return null
    }

    const keyValue = data?.[0]?.key_value
    if (!keyValue || !keyValue.startsWith('sk-')) {
      return null
    }

    return keyValue
  }

  // 创建新密钥（使用A000000格式）
  static async createApiKey(keyData: Omit<CreateApiKeyData, 'id'>): Promise<ApiKey> {
    try {
      // 生成A000000格式的ID
      const id = await this.generateKeyId()
      
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .insert({ ...keyData, id })
        .select()
        .single()

      if (error) {
        throw new Error(`创建密钥失败: ${error.message}`)
      }

      return data
    } catch (error) {
      throw error
    }
  }

  // 批量创建密钥
  static async createApiKeys(keysData: Omit<CreateApiKeyData, 'id'>[]): Promise<ApiKey[]> {
    // 为每个密钥生成A000000格式的ID
    const keysWithIds = []
    for (const keyData of keysData) {
      const id = await this.generateKeyId()
      keysWithIds.push({ ...keyData, id })
    }

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert(keysWithIds)
      .select()

    if (error) {
      throw new Error('批量创建密钥失败')
    }

    return data || []
  }

  // 更新密钥
  static async updateApiKey(id: string, keyData: UpdateApiKeyData): Promise<ApiKey> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .update(keyData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error('更新密钥失败')
    }

    return data
  }

  // 分配密钥给用户
  static async assignKeyToUser(userId: string, provider?: string): Promise<ApiKey | null> {
    try {
      // 查找可用的密钥
      let query = supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('status', 'active') // 使用数据库实际的状态值
        .order('id', { ascending: true }) // 按密钥ID顺序分配，优先填补空缺号码
        .limit(1)

      if (provider) {
        query = query.eq('provider', provider)
      }

      const { data: availableKeys, error: searchError } = await query

      if (searchError) {
        console.error('查找可用密钥时出错:', searchError)
        return null // 返回 null 而不是抛出异常
      }

      if (!availableKeys || availableKeys.length === 0) {
        console.log('暂无可用密钥')
        return null
      }

      const keyToAssign = availableKeys[0]

      // 分配密钥
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .update({
          status: 'assigned',
          assigned_user_id: userId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', keyToAssign.id)
        .select()
        .single()

      if (error) {
        console.error('分配密钥失败:', error)
        return null // 返回 null 而不是抛出异常
      }

      // 同步更新用户表的assigned_key_id字段
      try {
        const { error: userUpdateError } = await supabaseAdmin
          .from('users')
          .update({ assigned_key_id: data.id })
          .eq('id', userId)
        
        if (userUpdateError) {
          console.error('更新用户表assigned_key_id失败:', userUpdateError)
          // 不影响密钥分配结果
        } else {
          console.log('✅ 用户表assigned_key_id已同步更新')
        }
      } catch (syncError) {
        console.error('同步用户表时出错:', syncError)
      }

      console.log('✅ 密钥分配成功:', { userId, keyId: data.id })
      return data
    } catch (error) {
      console.error('密钥分配过程中出现意外错误:', error)
      return null
    }
  }

  // 解绑用户的密钥
  static async unbindUserKey(userId: string, keyId?: string): Promise<void> {
    // 首先获取密钥的原始状态，以决定恢复成什么状态
    let originalStatus = 'active'; // 默认恢复为active
    
    if (keyId) {
      const { data: keyData } = await supabaseAdmin
        .from('api_keys')
        .select('id')
        .eq('id', keyId)
        .single();
      
      // 如果密钥ID是旧格式（UUID），使用available，否则使用active
      if (keyData && ApiKeyService.isLegacyFormat(keyData.id)) {
        originalStatus = 'available';
      }
    }
    
    let query = supabaseAdmin
      .from('api_keys')
      .update({
        status: originalStatus,
        assigned_user_id: null,
        assigned_at: null
      })
      .eq('assigned_user_id', userId)

    if (keyId) {
      query = query.eq('id', keyId)
    }

    const { error } = await query

    if (error) {
      throw new Error('解绑密钥失败')
    }
  }

  // 删除密钥
  static async deleteApiKey(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error('删除密钥失败')
    }
  }

  // 统计密钥信息
  static async getKeyStatistics(): Promise<{
    total: number
    available: number
    assigned: number
    expired: number
    byProvider: Record<string, number>
  }> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('status, provider')

    if (error) {
      return {
        total: 0,
        available: 0,
        assigned: 0,
        expired: 0,
        byProvider: {}
      }
    }

    const stats = {
      total: data.length,
      available: 0,
      assigned: 0,
      expired: 0,
      byProvider: {} as Record<string, number>
    }

    data.forEach(key => {
      // 按状态统计
      if (key.status === 'available' || key.status === 'active') stats.available++
      else if (key.status === 'assigned') stats.assigned++
      else if (key.status === 'expired') stats.expired++

      // 按提供商统计
      stats.byProvider[key.provider] = (stats.byProvider[key.provider] || 0) + 1
    })

    return stats
  }

  // 清理过期密钥
  static async cleanupExpiredKeys(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('status', 'expired')
      .select('id')

    if (error) {
      throw new Error('清理过期密钥失败')
    }

    return data?.length || 0
  }

  // 标记密钥为过期
  static async markKeyAsExpired(id: string): Promise<ApiKey> {
    return this.updateApiKey(id, { 
      status: 'expired',
      assigned_user_id: null,
      assigned_at: null
    })
  }

  // 重新激活过期密钥
  static async reactivateExpiredKey(id: string): Promise<ApiKey> {
    // 重新激活为 active 状态
    return this.updateApiKey(id, { 
      status: 'active',
      assigned_user_id: null,
      assigned_at: null
    })
  }
}
