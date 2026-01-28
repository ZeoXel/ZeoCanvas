import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { BalanceService } from '@/lib/services/balance.service'
import { ApiKeyService } from '@/lib/services/apikey.service'
import { supabaseAdmin } from '@/lib/supabase'
import { getConversionRateByProvider, getPricingMultiplierByProvider } from '@/config/gateway.config'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { apiKey, userShortId } = body

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return NextResponse.json({ error: '无效的API密钥' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('total_recharge_amount, short_id')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.error('获取用户信息失败:', userError)
      throw new Error('获取用户信息失败: ' + userError.message)
    }

    if (!user) {
      throw new Error('用户不存在')
    }

    const totalRechargeInYuan = user.total_recharge_amount || 0
    const shortId = userShortId || user.short_id

    const userKeys = await ApiKeyService.getApiKeysByUserId(session.user.id)
    const currentKey = userKeys.find(k => k.key_value === apiKey && k.status === 'assigned')
    const provider = currentKey?.provider || 'lsapi'

    const usage = await BalanceService.queryApiKeyUsage(apiKey, session.user.id, shortId, provider)

    let apiConsumption = 0
    if (usage.success && usage.data) {
      const conversionRate = getConversionRateByProvider(provider)
      const pricingMultiplier = getPricingMultiplierByProvider(provider)
      const rawConsumption = usage.data.used / conversionRate
      apiConsumption = rawConsumption * pricingMultiplier
    }

    const balanceInYuan = totalRechargeInYuan - apiConsumption
    const currentBalance = balanceInYuan * 10

    return NextResponse.json({
      success: true,
      data: {
        balance: currentBalance,
        totalRechargeAmount: totalRechargeInYuan,
        totalRecharge: totalRechargeInYuan,
        apiConsumption: apiConsumption,
        message: '快速余额刷新完成',
      },
    })
  } catch (error) {
    console.error('快速余额刷新失败:', error)
    return NextResponse.json(
      {
        error: '刷新余额失败',
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    )
  }
}
