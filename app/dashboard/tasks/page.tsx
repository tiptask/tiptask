'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function TasksPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', suggested_amount: '', min_amount: '', category: '' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: t } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setTasks(t || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function addTask() {
    if (!profile || !form.title.trim()) return
    const { data } = await supabase.from('tasks').insert({ user_id: profile.id, title: form.title, description: form.description || null, suggested_amount: form.suggested_amount ? parseFloat(form.suggested_amount) : null, min_amount: form.min_amount ? parseFloat(form.min_amount) : null, category: form.category || null, is_active: true }).select().single()
    if (data) { setTasks(p => [data, ...p]); setForm({ title: '', description: '', suggested_amount: '', min_amount: '', category: '' }); setAdding(false) }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('tasks').update({ is_active: !current }).eq('id', id)
    setTasks(p => p.map(t => t.id === id ? { ...t, is_active: !current } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(p => p.filter(t => t.id !== id))
  }

  const currency = profile?.currency?.toUpperCase() ?? 'RON'
  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Tasks</h1></div>
            <button onClick={() => setAdding(p => !p)} className="bg-[#4AFFD4] text-[#08080C] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#6FFFDF] transition">+ Add</button>
          </div>

          {adding && (
            <div className="bg-[#111117] border border-[#4AFFD4]/20 rounded-2xl p-5 mb-5 space-y-3">
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title *" className={inputCls} />
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.suggested_amount} onChange={e => setForm(p => ({ ...p, suggested_amount: e.target.value }))} placeholder={`Fixed price (${currency})`} className={inputCls} />
                <input type="number" value={form.min_amount} onChange={e => setForm(p => ({ ...p, min_amount: e.target.value }))} placeholder={`Min amount (${currency})`} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={addTask} className="flex-1 bg-[#4AFFD4] text-[#08080C] py-2.5 rounded-xl font-bold text-sm hover:bg-[#6FFFDF] transition">Save task</button>
                <button onClick={() => setAdding(false)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/60 transition">Cancel</button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center"><p className="text-white/40 text-sm">No tasks yet</p><p className="text-white/20 text-xs mt-1">Tasks appear in the request form for your viewers</p></div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`bg-[#111117] border rounded-2xl p-4 transition ${task.is_active ? 'border-white/[0.06]' : 'border-white/[0.03] opacity-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold text-sm">{task.title}</p>
                      {task.description && <p className="text-white/35 text-xs mt-0.5">{task.description}</p>}
                      <div className="flex gap-3 mt-1">
                        {task.suggested_amount && <span className="text-[#4AFFD4] text-xs">{task.suggested_amount} {currency}</span>}
                        {task.min_amount && !task.suggested_amount && <span className="text-white/30 text-xs">min {task.min_amount} {currency}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleActive(task.id, task.is_active)} className={`w-10 h-5 rounded-full transition-colors ${task.is_active ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${task.is_active ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                      <button onClick={() => deleteTask(task.id)} className="text-white/20 hover:text-red-400 transition text-sm">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
