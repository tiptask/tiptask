import { useEffect } from 'react'
import { supabase } from './supabase'

type RealtimeConfig = {
  table: string
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  onUpdate: (payload: any) => void
  channelName: string
}

export function useRealtime(configs: RealtimeConfig[]) {
  useEffect(() => {
    const channels = configs.map(config => {
      const channel = supabase.channel(config.channelName + '-' + Date.now())
      channel.on('postgres_changes' as any, {
        event: config.event || '*',
        schema: 'public',
        table: config.table,
        ...(config.filter ? { filter: config.filter } : {}),
      }, config.onUpdate)
      channel.subscribe()
      return channel
    })
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [])
}
