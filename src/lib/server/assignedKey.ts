import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ApiKeyService } from '@/lib/services/apikey.service'

export async function getAssignedGatewayKey(provider?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { userId: null, apiKey: null }
  }

  const apiKey = await ApiKeyService.getAssignedKeyValueByUserId(session.user.id, provider)
  return { userId: session.user.id, apiKey }
}
