/**
 * 积分事件系统
 * 用于在积分变化时通知 UI 组件刷新
 */

// 自定义事件名称
export const CREDITS_UPDATED_EVENT = 'credits:updated';

// 事件数据类型
export interface CreditsUpdatedEventDetail {
  credits: number;
  balance: number;
  type: 'consumption' | 'recharge' | 'refund' | 'reward';
  service?: string;
}

/**
 * 触发积分更新事件
 */
export function emitCreditsUpdated(detail: CreditsUpdatedEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CREDITS_UPDATED_EVENT, { detail }));
  }
}

/**
 * 监听积分更新事件
 */
export function onCreditsUpdated(callback: (detail: CreditsUpdatedEventDetail) => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CreditsUpdatedEventDetail>;
    callback(customEvent.detail);
  };

  window.addEventListener(CREDITS_UPDATED_EVENT, handler);

  // 返回取消监听的函数
  return () => {
    window.removeEventListener(CREDITS_UPDATED_EVENT, handler);
  };
}
