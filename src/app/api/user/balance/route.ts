import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { BalanceService } from '@/lib/services/balance.service'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const balanceInfo = await BalanceService.getUserBalanceInfo(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        userId: balanceInfo.userId,
        totalRecharge: balanceInfo.totalRecharge,
        apiConsumption: balanceInfo.apiConsumption,
        currentBalance: balanceInfo.currentBalance,
        apiKeys: balanceInfo.apiKeys.map(key => ({
          id: key.id,
          provider: key.provider,
          keyPreview: `${key.keyValue.substring(0, 8)}...${key.keyValue.substring(key.keyValue.length - 8)}`,
          usage: key.usage,
        })),
      },
    })
  } catch (error) {
    console.error('获取用户余额失败:', error)
    return NextResponse.json(
      {
        error: '获取余额信息失败',
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    )
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const balanceInfo = await BalanceService.getUserBalanceInfo(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        balance: balanceInfo.currentBalance,
        totalRechargeAmount: balanceInfo.totalRecharge,
        totalRecharge: balanceInfo.totalRecharge,
        apiConsumption: balanceInfo.apiConsumption,
        message: '余额已刷新',
      },
    })
  } catch (error) {
    console.error('刷新用户余额失败:', error)
    return NextResponse.json(
      {
        error: '刷新余额失败',
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    )
  }
}
